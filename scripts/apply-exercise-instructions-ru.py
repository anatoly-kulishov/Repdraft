#!/usr/bin/env python3
"""Apply RU technique steps into exercises.full.json catalogs.

Merge order: generated EN→RU batch, then curated overrides (win).
Curated source: powermens.ru / Delavier-style; JM Press hand-written.

Usage:
  python3 scripts/apply-exercise-instructions-ru.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OVERRIDES_PATH = ROOT / "static/data/exercise-instructions.ru.overrides.json"
GENERATED_PATH = ROOT / "static/data/exercise-instructions.ru.generated.json"
FULL_PATHS = [
	ROOT / "data/exercises.full.json",
	ROOT / "static/data/exercises.full.json",
]


def polish_step(text: str) -> str:
	s = text.strip()
	s = re.sub(r"\bЛежа\b", "Лёжа", s)
	s = re.sub(r"\bлежа\b", "лёжа", s)
	s = re.sub(r"\bЕще\b", "Ещё", s)
	s = re.sub(r"\bеще\b", "ещё", s)
	s = re.sub(r"\bее\b", "её", s)
	s = re.sub(r"\bЕе\b", "Её", s)
	s = re.sub(r"тренажер(?!ё)", "тренажёр", s)
	s = re.sub(r"Тренажер(?!ё)", "Тренажёр", s)
	s = s.replace("коснется", "коснётся").replace("Коснется", "Коснётся")
	s = re.sub(
		r"(на\s+)?предсвороточн\w*\s+скамь([еююи])",
		r"\1скамь\2 Скотта",
		s,
		flags=re.I,
	)
	s = re.sub(r"предсвороточн\w*", "Скотта", s, flags=re.I)
	s = re.sub(r"предакеровск\w*", "Скотта", s, flags=re.I)
	s = re.sub(r"на Скотта скамь([еююи])", r"на скамь\1 Скотта", s)
	s = re.sub(r"на Скотта валике", "на валике скамьи Скотта", s, flags=re.I)
	s = re.sub(r"на Скотта подушке", "на подушке скамьи Скотта", s, flags=re.I)
	s = re.sub(r"скамь([аеюяюи]) проповедника", r"скамь\1 Скотта", s, flags=re.I)
	s = re.sub(r"Настройте кабельную машину", "Настройте блочный тренажёр", s)
	s = re.sub(r"кабельную насадку", "блочную рукоятку", s, flags=re.I)
	s = re.sub(r"Кабельную насадку", "Блочную рукоятку", s)
	s = re.sub(r"\bкабельную машину\b", "блочный тренажёр", s, flags=re.I)
	s = re.sub(r"\bкабельной машины\b", "блочного тренажёра", s, flags=re.I)
	s = re.sub(r"\bкабельной машине\b", "блочном тренажёре", s, flags=re.I)
	s = re.sub(r"\bкабельной машиной\b", "блочным тренажёром", s, flags=re.I)
	s = re.sub(r"\bкабельная машина\b", "блочный тренажёр", s, flags=re.I)
	s = re.sub(r"\bкабельн\w*\s+машин\w*\b", "блочный тренажёр", s, flags=re.I)
	s = re.sub(r"\bправильную форму\b", "технику", s, flags=re.I)
	s = re.sub(r"\bПравильную форму\b", "Технику", s)
	s = re.sub(r"\bБарbell\b", "Штанга", s)
	s = re.sub(r"\bбарbell\b", "штанга", s)
	s = re.sub(r"\bBarbell\b", "Штанга", s)
	s = re.sub(r"\bbarbell\b", "штанга", s)
	# UI copy: no em/en dash as punctuation.
	s = s.replace("—", " - ").replace("–", " - ")
	s = re.sub(r"\s+-\s+", " - ", s)
	s = re.sub(r"\bкнизу\b", "к низу", s, flags=re.I)
	s = s.replace("Смитта", "Смита")
	s = re.sub(r"\bстабильность мяч[аеиу]?\b", "фитбол", s, flags=re.I)
	s = re.sub(r"\bстабильность мячом\b", "фитболом", s, flags=re.I)
	s = re.sub(r"\bна фитбол\b", "на фитбол", s, flags=re.I)
	s = re.sub(r"Сядьте на фитбол,", "Сядьте на фитбол,", s)
	s = re.sub(r"Поместите фитбол на пол", "Положите фитбол на пол", s)
	s = re.sub(r"\bстабильность мяч\b", "фитбол", s, flags=re.I)
	s = re.sub(r"\s{2,}", " ", s).strip()
	return s


_KB_TO_DB: list[tuple[str, str]] = [
	(r"\bГирями\b", "Гантелями"),
	(r"\bгирями\b", "гантелями"),
	(r"\bгирях\b", "гантелях"),
	(r"\bГирей\b", "Гантелью"),
	(r"\bгирей\b", "гантелью"),
	(r"\bГирю\b", "Гантель"),
	(r"\bгирю\b", "гантель"),
	(r"\bГири\b", "Гантели"),
	(r"\bгири\b", "гантели"),
	(r"\bГире\b", "Гантели"),
	(r"\bгире\b", "гантели"),
	(r"\bГиря\b", "Гантель"),
	(r"\bгиря\b", "гантель"),
]


def polish_step_for_name(name: str, text: str) -> str:
	s = polish_step(text)
	n = name.lower()
	if "dumbbell" in n and "kettlebell" not in n:
		for pat, repl in _KB_TO_DB:
			s = re.sub(pat, repl, s)
	return s


def polish_map(data: dict[str, list[str]]) -> dict[str, list[str]]:
	return {oid: [polish_step(s) for s in steps] for oid, steps in data.items()}


def main() -> None:
	overrides: dict[str, list[str]] = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
	polished_ov = polish_map(overrides)
	if polished_ov != overrides:
		OVERRIDES_PATH.write_text(
			json.dumps(polished_ov, ensure_ascii=False, indent="\t") + "\n",
			encoding="utf-8",
		)
		overrides = polished_ov

	generated: dict[str, list[str]] = {}
	if GENERATED_PATH.exists():
		generated = json.loads(GENERATED_PATH.read_text(encoding="utf-8"))
		polished_gen = polish_map(generated)
		if polished_gen != generated:
			GENERATED_PATH.write_text(
				json.dumps(polished_gen, ensure_ascii=False, indent="\t") + "\n",
				encoding="utf-8",
			)
			generated = polished_gen

	names: dict[str, str] = {}
	for path in FULL_PATHS:
		if not path.exists():
			continue
		for ex in json.loads(path.read_text(encoding="utf-8")):
			oid = str(ex.get("id", ""))
			if oid and oid not in names:
				names[oid] = str(ex.get("name") or "")
		break

	patched_gen: dict[str, list[str]] = {}
	gen_changed = False
	for oid, steps in generated.items():
		polished = [polish_step_for_name(names.get(oid, ""), s) for s in steps]
		patched_gen[oid] = polished
		if polished != steps:
			gen_changed = True
	if gen_changed:
		GENERATED_PATH.write_text(
			json.dumps(patched_gen, ensure_ascii=False, indent="\t") + "\n",
			encoding="utf-8",
		)
	generated = patched_gen

	# Curated overrides win over batch translations.
	# ponytail: do not name-rewrite overrides. Goblet etc. may say «гантель или гиря» on purpose.
	merged = {**generated, **overrides}

	for path in FULL_PATHS:
		if not path.exists():
			continue
		data = json.loads(path.read_text(encoding="utf-8"))
		updated = 0
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
			updated += 1
		path.write_text(
			json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n",
			encoding="utf-8",
		)
		print(f"updated {path.relative_to(ROOT)}: {updated} exercises")


if __name__ == "__main__":
	main()
