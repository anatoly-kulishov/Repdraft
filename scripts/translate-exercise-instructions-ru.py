#!/usr/bin/env python3
"""Translate all exercise instruction_steps EN→RU via GigaChat.

Keeps curated overrides untouched. Resumable progress file.
Usage: python3 scripts/translate-exercise-instructions-ru.py
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FULL_PATH = ROOT / "static/data/exercises.full.json"
OVERRIDES_PATH = ROOT / "static/data/exercise-instructions.ru.overrides.json"
PROGRESS_PATH = ROOT / "static/data/exercise-instructions.ru.generated.json"
ENV_PATH = ROOT / ".env"

BATCH_SIZE = 3
MAX_RETRIES = 4
SLEEP_BETWEEN = 0.35

SYSTEM = """Ты переводчик инструкций силовых упражнений на русский.
Правила:
- Переводи каждый шаг техники четко, в повелительном наклонении (лягте, возьмите, выжмите).
- Термины зала: жим, тяга, приседания, разведение, сгибание, хват сверху/снизу, блок, тренажёр Смита, EZ-гриф.
- «жим к низу» только с пробелом (не «книзу»).
- Используй букву ё где нужно (лёжа, ещё, её, тренажёр, коснётся).
- Не используй длинное тире (—) и среднее (–); только дефис (-) или запятая/точка.
- Не добавляй советы, мышцы и маркетинг. Только техника по шагам.
- Ответ СТРОГО JSON-объект: ключ = id упражнения, значение = массив строк (шаги на русском).
- Число шагов для каждого id должно совпадать с входным.
- Без markdown и комментариев."""


def load_env() -> dict[str, str]:
	out: dict[str, str] = {}
	if not ENV_PATH.exists():
		return out
	for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
		line = line.strip()
		if not line or line.startswith("#") or "=" not in line:
			continue
		k, v = line.split("=", 1)
		out[k.strip()] = v.strip().strip('"').strip("'")
	return out


def polish_step(s: str) -> str:
	s = s.strip()
	s = s.replace("—", " - ").replace("–", " - ")
	s = re.sub(r"\s+-\s+", " - ", s)
	s = re.sub(r"\bкнизу\b", "к низу", s, flags=re.I)
	s = re.sub(r"\bЛежа\b", "Лёжа", s)
	s = re.sub(r"\bлежа\b", "лёжа", s)
	s = re.sub(r"\bЕще\b", "Ещё", s)
	s = re.sub(r"\bеще\b", "ещё", s)
	s = re.sub(r"\bее\b", "её", s)
	s = re.sub(r"\bЕе\b", "Её", s)
	# ё in machine / contact forms
	s = re.sub(r"тренажер(?!ё)", "тренажёр", s)
	s = re.sub(r"Тренажер(?!ё)", "Тренажёр", s)
	s = s.replace("коснется", "коснётся").replace("Коснется", "Коснётся")
	# Scott bench typo from models → «скамья Скотта»
	s = re.sub(
		r"(на\s+)?предсвороточн\w*\s+скамь([еююи])",
		r"\1скамь\2 Скотта",
		s,
		flags=re.I,
	)
	s = re.sub(r"предсвороточн\w*", "Скотта", s, flags=re.I)
	s = re.sub(r"на Скотта скамь([еююи])", r"на скамь\1 Скотта", s)
	s = re.sub(r"\bБарbell\b", "Штанга", s)
	s = re.sub(r"\bбарbell\b", "штанга", s)
	s = re.sub(r"\bBarbell\b", "Штанга", s)
	s = re.sub(r"\bbarbell\b", "штанга", s)
	s = re.sub(r"\s{2,}", " ", s).strip()
	return s


def polish_steps(steps: list[str]) -> list[str]:
	return [polish_step(s) for s in steps if polish_step(s)]


def steps_hash(steps: list[str]) -> str:
	blob = "\n".join(steps).strip().lower()
	return hashlib.sha1(blob.encode("utf-8")).hexdigest()


class GigaChat:
	def __init__(self, env: dict[str, str]) -> None:
		self.api_key = (env.get("GIGACHAT_API_KEY") or "").replace("sk-", "")
		self.base = (env.get("GIGACHAT_BASE_URL") or "https://api.giga.chat/v1").rstrip("/")
		self.oauth = (
			env.get("GIGACHAT_OAUTH_URL")
			or "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
		)
		self.scope = env.get("GIGACHAT_SCOPE") or "GIGACHAT_API_PERS"
		self.model = env.get("GIGACHAT_MODEL") or "GigaChat-2"
		verify = (env.get("GIGACHAT_SSL_VERIFY") or "false").lower() in ("1", "true", "yes")
		self.ctx = ssl.create_default_context() if verify else ssl._create_unverified_context()
		self.token: str | None = None
		self.token_exp = 0.0
		if not self.api_key:
			raise SystemExit("GIGACHAT_API_KEY missing in .env")

	def _request(
		self,
		url: str,
		method: str,
		headers: dict[str, str],
		body: bytes | None = None,
	) -> tuple[int, str]:
		req = urllib.request.Request(url, data=body, headers=headers, method=method)
		try:
			with urllib.request.urlopen(req, context=self.ctx, timeout=90) as res:
				return res.status, res.read().decode("utf-8")
		except urllib.error.HTTPError as e:
			return e.code, e.read().decode("utf-8", errors="replace")

	def ensure_token(self, force: bool = False) -> str:
		now = time.time()
		if not force and self.token and self.token_exp > now + 30:
			return self.token
		body = urllib.parse.urlencode({"scope": self.scope}).encode()
		status, text = self._request(
			self.oauth,
			"POST",
			{
				"Content-Type": "application/x-www-form-urlencoded",
				"Accept": "application/json",
				"RqUID": str(uuid.uuid4()),
				"Authorization": f"Basic {self.api_key}",
			},
			body,
		)
		if status < 200 or status >= 300:
			raise RuntimeError(f"OAuth failed {status}: {text[:300]}")
		data = json.loads(text)
		token = data.get("access_token")
		if not token:
			raise RuntimeError(f"OAuth no token: {text[:300]}")
		exp = data.get("expires_at")
		if isinstance(exp, (int, float)):
			self.token_exp = exp / 1000 if exp > 1e12 else float(exp)
		else:
			self.token_exp = now + 25 * 60
		self.token = token
		return token

	def chat_json(self, user: str) -> dict:
		for attempt in range(MAX_RETRIES):
			token = self.ensure_token(force=attempt > 0 and attempt % 2 == 1)
			payload = {
				"model": self.model,
				"temperature": 0.15,
				"messages": [
					{"role": "system", "content": SYSTEM},
					{"role": "user", "content": user},
				],
			}
			status, text = self._request(
				f"{self.base}/chat/completions",
				"POST",
				{
					"Authorization": f"Bearer {token}",
					"Content-Type": "application/json",
					"Accept": "application/json",
				},
				json.dumps(payload, ensure_ascii=False).encode("utf-8"),
			)
			if status == 401:
				self.token = None
				continue
			if status == 429 or status >= 500:
				time.sleep(1.2 * (attempt + 1))
				continue
			if status < 200 or status >= 300:
				raise RuntimeError(f"chat failed {status}: {text[:400]}")
			msg = json.loads(text)["choices"][0]["message"]["content"]
			return parse_json_object(msg)
		raise RuntimeError("chat retries exhausted")


def parse_json_object(raw: str) -> dict:
	text = raw.strip()
	if text.startswith("```"):
		text = re.sub(r"^```(?:json)?\s*", "", text)
		text = re.sub(r"\s*```$", "", text)
	# common model glitches
	text = text.replace("\n", "\n")
	candidates = [text]
	m = re.search(r"\{[\s\S]*\}", text)
	if m:
		candidates.append(m.group(0))
	for cand in candidates:
		for fixer in (
			lambda s: s,
			lambda s: re.sub(r",\s*}", "}", re.sub(r",\s*]", "]", s)),
			lambda s: re.sub(r"'", '"', s),
		):
			try:
				data = json.loads(fixer(cand))
				if isinstance(data, dict):
					return data
			except json.JSONDecodeError:
				continue
	raise ValueError(f"no JSON object in model output: {text[:200]}")


def main() -> None:
	env = load_env()
	catalog = json.loads(FULL_PATH.read_text(encoding="utf-8"))
	overrides: dict[str, list[str]] = {}
	if OVERRIDES_PATH.exists():
		overrides = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))

	generated: dict[str, list[str]] = {}
	if PROGRESS_PATH.exists():
		generated = json.loads(PROGRESS_PATH.read_text(encoding="utf-8"))

	# Deduplicate by EN steps hash
	hash_to_ids: dict[str, list[str]] = {}
	id_to_en: dict[str, list[str]] = {}
	for ex in catalog:
		oid = str(ex.get("id", ""))
		if not oid or oid in overrides:
			continue
		en = ex.get("instruction_steps", {}).get("en") or []
		if not isinstance(en, list) or len(en) < 2:
			continue
		en = [str(s).strip() for s in en if str(s).strip()]
		if len(en) < 2:
			continue
		id_to_en[oid] = en
		h = steps_hash(en)
		hash_to_ids.setdefault(h, []).append(oid)

	pending_hashes = [h for h, ids in hash_to_ids.items() if not any(i in generated for i in ids)]
	print(
		f"catalog={len(catalog)} overrides={len(overrides)} "
		f"unique_en={len(hash_to_ids)} pending_unique={len(pending_hashes)} "
		f"already_generated={len(generated)}"
	)

	client = GigaChat(env)
	done = 0
	for i in range(0, len(pending_hashes), BATCH_SIZE):
		batch_hashes = pending_hashes[i : i + BATCH_SIZE]
		batch_items = []
		for h in batch_hashes:
			oid = hash_to_ids[h][0]
			batch_items.append({"id": oid, "steps": id_to_en[oid]})

		user = (
			"Переведи шаги техники на русский. Верни JSON {id: [шаги...]}.\n"
			+ json.dumps(batch_items, ensure_ascii=False)
		)
		try:
			result = client.chat_json(user)
		except Exception as err:
			print(f"batch {i // BATCH_SIZE + 1} failed: {err}")
			time.sleep(2)
			continue

		for item in batch_items:
			oid = item["id"]
			h = steps_hash(item["steps"])
			raw_steps = result.get(oid) or result.get(str(oid))
			if not isinstance(raw_steps, list) or len(raw_steps) < 2:
				# try any key
				for v in result.values():
					if isinstance(v, list) and len(v) == len(item["steps"]):
						raw_steps = v
						break
			if not isinstance(raw_steps, list) or len(raw_steps) < 2:
				print(f"  skip bad output for {oid}")
				continue
			ru = polish_steps([str(s) for s in raw_steps])
			if len(ru) < 2:
				continue
			# apply to all ids sharing this EN hash
			for shared_id in hash_to_ids[h]:
				generated[shared_id] = ru
			done += 1

		PROGRESS_PATH.write_text(
			json.dumps(generated, ensure_ascii=False, indent="\t") + "\n",
			encoding="utf-8",
		)
		print(
			f"batch {i // BATCH_SIZE + 1}/{(len(pending_hashes) + BATCH_SIZE - 1) // BATCH_SIZE} "
			f"generated={len(generated)} (+{done} this run)"
		)
		time.sleep(SLEEP_BETWEEN)

	# Final bake into catalogs
	merged = {**generated, **overrides}  # overrides win
	for path in (ROOT / "data/exercises.full.json", ROOT / "static/data/exercises.full.json"):
		if not path.exists():
			continue
		data = json.loads(path.read_text(encoding="utf-8"))
		n = 0
		for ex in data:
			oid = str(ex.get("id", ""))
			steps = merged.get(oid)
			if not steps:
				continue
			if not isinstance(ex.get("instruction_steps"), dict):
				ex["instruction_steps"] = {}
			if not isinstance(ex.get("instructions"), dict):
				ex["instructions"] = {}
			ex["instruction_steps"]["ru"] = steps
			ex["instructions"]["ru"] = " ".join(steps)
			n += 1
		path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
		print(f"baked {path.relative_to(ROOT)}: {n} exercises with RU steps")


if __name__ == "__main__":
	main()
