#!/usr/bin/env python3
"""Bake Russian exercise titles (name_ru) into static JSON catalogs."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "static/data/exercises.index.json"
FULL_PATH = ROOT / "data/exercises.full.json"
OVERRIDES_PATH = ROOT / "static/data/exercise-names.ru.overrides.json"

# Leading equipment → natural Russian adjunct (usually at the end).
EQUIPMENT_PREFIX: list[tuple[str, str]] = [
	("olympic barbell", "с олимпийской штангой"),
	("ez barbell", "с EZ-грифом"),
	("trap bar", "с трэп-грифом"),
	("smith machine", "в машине Смита"),
	("leverage machine", "в рычажном тренажёре"),
	("sled machine", "на санях"),
	("skierg machine", "на SkiErg"),
	("elliptical machine", "на эллипсе"),
	("stepmill machine", "на степмилле"),
	("stationary bike", "на велотренажёре"),
	("upper body ergometer", "на арм-эргометре"),
	("stability ball", "с фитболом"),
	("medicine ball", "с медболом"),
	("bosu ball", "на босу"),
	("resistance band", "с эспандером"),
	("wheel roller", "с колесом"),
	("body weight", "с собственным весом"),
	("kettlebell", "с гирей"),
	("dumbbell", "с гантелями"),
	"barbell",
]

# Fix: keep list of tuples only
EQUIPMENT_PREFIX = [
	("olympic barbell", "с олимпийской штангой"),
	("ez barbell", "с EZ-грифом"),
	("trap bar", "с трэп-грифом"),
	("smith machine", "в машине Смита"),
	("leverage machine", "в рычажном тренажёре"),
	("sled machine", "на санях"),
	("skierg machine", "на SkiErg"),
	("elliptical machine", "на эллипсе"),
	("stepmill machine", "на степмилле"),
	("stationary bike", "на велотренажёре"),
	("upper body ergometer", "на арм-эргометре"),
	("stability ball", "с фитболом"),
	("medicine ball", "с медболом"),
	("bosu ball", "на босу"),
	("resistance band", "с эспандером"),
	("wheel roller", "с колесом"),
	("body weight", "с собственным весом"),
	("kettlebell", "с гирей"),
	("dumbbell", "с гантелями"),
	("barbell", "со штангой"),
	("cable", "на блоке"),
	("band", "с резинкой"),
	("lever", "в рычажном тренажёре"),
	("smith", "в машине Смита"),
	("ez", "с EZ-грифом"),
	("rope", "с канатом"),
	("tire", "с покрышкой"),
	("roller", "с роллером"),
	("weighted", "с отягощением"),
	("assisted", "с поддержкой"),
]

PHRASES: list[tuple[str, str]] = [
	("close-grip", "узким хватом"),
	("wide-grip", "широким хватом"),
	("neutral-grip", "нейтральным хватом"),
	("close grip", "узким хватом"),
	("wide grip", "широким хватом"),
	("neutral grip", "нейтральным хватом"),
	("overhand grip", "прямым хватом"),
	("underhand grip", "обратным хватом"),
	("reverse grip", "обратным хватом"),
	("hammer grip", "молотковым хватом"),
	("one arm", "одной рукой"),
	("one leg", "на одной ноге"),
	("single arm", "одной рукой"),
	("single leg", "на одной ноге"),
	("alternate arm", "поочерёдно руками"),
	("bench press", "жим лёжа"),
	("guillotine bench press", "жим лёжа «гильотина»"),
	("shoulder press", "жим плечами"),
	("military press", "армейский жим"),
	("overhead press", "жим над головой"),
	("chest press", "жим на грудь"),
	("leg press", "жим ногами"),
	("calf raise", "подъём на носки"),
	("calf raises", "подъёмы на носки"),
	("front raise", "подъём вперёд"),
	("lateral raise", "разведение в стороны"),
	("rear delt", "задние дельты"),
	("side bend", "наклон в сторону"),
	("side bends", "наклоны в сторону"),
	("hip thrust", "ягодичный мост"),
	("hip extension", "разгибание бедра"),
	("leg extension", "разгибание ног"),
	("leg curl", "сгибание ног"),
	("preacher curl", "сгибание на скамье Скотта"),
	("concentration curl", "концентрированное сгибание"),
	("bicep curl", "сгибание на бицепс"),
	("biceps curl", "сгибание на бицепс"),
	("triceps extension", "разгибание на трицепс"),
	("skull crusher", "французский жим"),
	("face pull", "тяга к лицу"),
	("upright row", "тяга к подбородку"),
	("bent over row", "тяга в наклоне"),
	("bent-over row", "тяга в наклоне"),
	("seated row", "тяга сидя"),
	("inverted row", "горизонтальные подтягивания"),
	("lat pulldown", "тяга верхнего блока"),
	("romanian deadlift", "румынская тяга"),
	("sumo deadlift", "становая тяга сумо"),
	("stiff leg deadlift", "тяга на прямых ногах"),
	("straight leg deadlift", "тяга на прямых ногах"),
	("power clean", "силовое взятие на грудь"),
	("hang clean", "взятие с виса"),
	("clean and jerk", "толчок"),
	("clean and press", "взятие на грудь и жим"),
	("push press", "швунг жимовой"),
	("glute bridge", "ягодичный мост"),
	("chest fly", "разведение на грудь"),
	("cable crossover", "кроссовер"),
	("pec deck", "бабочка"),
	("push-up", "отжимания"),
	("push up", "отжимания"),
	("pull-up", "подтягивания"),
	("pull up", "подтягивания"),
	("chin-up", "подтягивания обратным хватом"),
	("chin up", "подтягивания обратным хватом"),
	("sit-up", "скручивания"),
	("sit up", "скручивания"),
	("v-sit", "V-складка"),
	("mountain climber", "скалолаз"),
	("box jump", "прыжок на тумбу"),
	("high knees", "высокие колени"),
	("farmer walk", "прогулка фермера"),
	("farmers walk", "прогулка фермера"),
	("turkish get-up", "турецкий подъём"),
	("turkish get up", "турецкий подъём"),
	("ab wheel", "колесо для пресса"),
	("side plank", "боковая планка"),
	("wall sit", "стульчик у стены"),
	("decline bench", "на наклонной скамье вниз"),
	("incline bench", "на наклонной скамье"),
	("flat bench", "на горизонтальной скамье"),
	("sissy squat", "сисси-присед"),
	("hack squat", "гакк-присед"),
	("bulgarian split squat", "болгарский сплит-присед"),
	("single leg split squat", "болгарский сплит-присед"),
	("split squats", "сплит-приседания"),
	("split squat", "сплит-присед"),
	("suspended split squat", "сплит-присед в подвеске"),
	("side split squat", "боковой сплит-присед"),
	("step-up split squat", "зашагивание в сплит-присед"),
	("step-up lunge", "зашагивание с выпадом"),
	("lunge with jump", "прыжковые выпады"),
	("lunge with twist", "выпад с поворотом"),
	("walking high knees lunge", "выпады с высоким подниманием колен"),
	("contralateral forward lunge", "контралатеральный выпад вперёд"),
	("lunge pass through", "сквозной выпад"),
	("stretch lunge", "растяжка в выпаде"),
	("lunge with swing", "выпад с махами"),
	("sprint lunge", "спринтовый выпад"),
	("rear lunge", "выпад назад"),
	("v. 2", "вариант 2"),
	("goblet squat", "гоблет-присед"),
	("front squat", "фронтальный присед"),
	("back squat", "присед со штангой на спине"),
	("overhead squat", "присед над головой"),
	("pistol squat", "пистолетик"),
	("cossack squat", "казачий присед"),
	("jump squat", "прыжковый присед"),
	("walking lunge", "выпады в ходьбе"),
	("reverse lunge", "выпад назад"),
	("forward lunge", "выпад вперёд"),
	("lateral lunge", "выпад в сторону"),
	("curtsy lunge", "выпад крест-накрест"),
	("step-up", "зашагивание"),
	("step up", "зашагивание"),
	("donkey kick", "отведение ноги назад"),
	("fire hydrant", "подъём ноги в сторону"),
	("back extension", "разгибание спины"),
	("wrist curl", "сгибание запястий"),
	("wrist extension", "разгибание запястий"),
	("bent over", "в наклоне"),
	("bent-over", "в наклоне"),
	("bent arm", "согнутой рукой"),
	("straight arm", "прямой рукой"),
	("straight leg", "на прямой ноге"),
	("pushdown", "разгибание вниз на блоке"),
	("push-down", "разгибание вниз на блоке"),
	("pulldown", "тяга блока"),
	("pullover", "пуловер"),
	("pull-over", "пуловер"),
	("kickback", "отведение назад"),
	("kickbacks", "отведения назад"),
	("deadlift", "становая тяга"),
	("hyperextension", "гиперэкстензия"),
	("jumping jack", "прыжки джекинг"),
	("burpee", "берпи"),
	("thruster", "трастер"),
	("thrusters", "трастеры"),
	("superman", "супермен"),
	("woodchop", "дровосек"),
	("archer push-up", "отжимания лучника"),
	("archer push up", "отжимания лучника"),
	("chest dip", "отжимания на брусьях на грудь"),
	("wide-grip chest dip", "отжимания на брусьях широким хватом на грудь"),
	("stability ball", "с фитболом"),
	("with stability ball", "с фитболом"),
	("medicine ball", "с медболом"),
	("bosu ball", "на босу"),
	("decline pullover", "пуловер вниз головой"),
	("decline press", "жим вниз головой"),
	("incline press", "жим на наклонной скамье"),
	("incline fly", "разведение на наклонной скамье"),
	("decline fly", "разведение вниз головой"),
	("front raise and pullover", "подъём вперёд и пуловер"),
	("guillotine", "гильотина"),
	("archer", "лучника"),
	("diamond", "алмазные"),
	("pectoralis major", "большой грудной"),
	("pectoralis minor", "малой грудной"),
	("full squat", "присед"),
	("side pov", "вид сбоку"),
	("back pov", "вид сзади"),
	("front pov", "вид спереди"),
	("pallof press", "жим Паллофа"),
	("pallof", "Паллофа"),
	("inverse leg curl", "обратное сгибание ног"),
	("deep push up", "глубокие отжимания"),
	("deep push-up", "глубокие отжимания"),
	("hip thrust", "ягодичный мост"),
	("hip thrusts", "ягодичный мост"),
]

WORDS: dict[str, str] = {
	"press": "жим",
	"curl": "сгибание",
	"curls": "сгибания",
	"row": "тяга",
	"rows": "тяги",
	"raise": "подъём",
	"raises": "подъёмы",
	"fly": "разведение",
	"flye": "разведение",
	"flyes": "разведения",
	"flies": "разведения",
	"dip": "отжимания на брусьях",
	"dips": "отжимания на брусьях",
	"squat": "присед",
	"squats": "приседания",
	"lunge": "выпад",
	"lunges": "выпады",
	"crunch": "скручивание",
	"crunches": "скручивания",
	"twist": "скручивание",
	"twisting": "со скручиванием",
	"stretch": "растяжка",
	"extension": "разгибание",
	"extensions": "разгибания",
	"flexion": "сгибание",
	"abduction": "отведение",
	"adduction": "приведение",
	"rotation": "ротация",
	"rotational": "ротационный",
	"shrug": "шраги",
	"shrugs": "шраги",
	"swing": "махи",
	"swings": "махи",
	"jump": "прыжок",
	"jumps": "прыжки",
	"kick": "удар",
	"climb": "подъём",
	"walk": "ходьба",
	"run": "бег",
	"sprint": "спринтовый",
	"contralateral": "контралатеральный",
	"through": "сквозной",
	"bowling": "боулинг",
	"split": "сплит",
	"hold": "удержание",
	"plank": "планка",
	"bridge": "мост",
	"roll": "прокат",
	"rollout": "прокат",
	"carry": "переноска",
	"throw": "бросок",
	"chop": "рубящее",
	"circle": "круги",
	"circles": "круги",
	"snatch": "рывок",
	"clean": "взятие на грудь",
	"jerk": "толчок",
	"pull": "тяга",
	"push": "жим",
	"arm": "рукой",
	"arms": "руками",
	"leg": "ногой",
	"legs": "ногами",
	"wrist": "запястий",
	"knee": "колена",
	"knees": "коленей",
	"hip": "бедра",
	"hips": "бёдер",
	"back": "спины",
	"chest": "на грудь",
	"shoulder": "плеча",
	"shoulders": "плеч",
	"neck": "шеи",
	"abs": "пресса",
	"ab": "пресса",
	"core": "кора",
	"glute": "ягодиц",
	"glutes": "ягодиц",
	"hamstring": "бицепса бедра",
	"hamstrings": "бицепса бедра",
	"quad": "квадрицепса",
	"quads": "квадрицепса",
	"calf": "икр",
	"calves": "икр",
	"bicep": "бицепса",
	"biceps": "бицепса",
	"triceps": "трицепса",
	"tricep": "трицепса",
	"forearm": "предплечья",
	"forearms": "предплечий",
	"delt": "дельты",
	"delts": "дельт",
	"deltoid": "дельты",
	"trap": "трапеции",
	"traps": "трапеций",
	"lat": "широчайших",
	"lats": "широчайших",
	"pec": "грудных",
	"pecs": "грудных",
	"pectoralis": "грудных",
	"pectoral": "грудных",
	"major": "большой",
	"minor": "малой",
	"hand": "рукой",
	"hands": "руками",
	"pov": "вид",
	"deep": "глубокие",
	"drop": "с возвышения",
	"inverse": "обратное",
	"support": "с опорой",
	"lying": "лёжа",
	"seated": "сидя",
	"standing": "стоя",
	"kneeling": "на коленях",
	"hanging": "в висе",
	"parallel": "параллельным",
	"rope": "канатом",
	"attachment": "рукоятью",
	"bodyweight": "с собственным весом",
	"sled": "на санях",
	"rear": "задний",
	"front": "передний",
	"side": "боковой",
	"lateral": "боковой",
	"inner": "внутренний",
	"outer": "внешний",
	"upper": "верхний",
	"lower": "нижний",
	"middle": "средний",
	"mid": "средний",
	"high": "высокий",
	"low": "низкий",
	"wide": "широкий",
	"close": "узкий",
	"narrow": "узкий",
	"straight": "прямой",
	"bent": "согнутый",
	"single": "одной",
	"double": "двойной",
	"one": "одной",
	"two": "двумя",
	"half": "половинный",
	"full": "полный",
	"reverse": "обратный",
	"inverted": "перевёрнутый",
	"overhead": "над головой",
	"underhand": "обратным хватом",
	"overhand": "прямым хватом",
	"neutral": "нейтральный",
	"grip": "хватом",
	"handle": "рукоятью",
	"handles": "рукоятями",
	"ball": "мячом",
	"bench": "на скамье",
	"floor": "на полу",
	"wall": "у стены",
	"box": "на тумбу",
	"machine": "в тренажёре",
	"bar": "с грифом",
	"hammer": "молотковый",
	"exercise": "упражнение",
	"variation": "вариант",
	"isometric": "изометрический",
	"explosive": "взрывной",
	"plyometric": "плиометрический",
	"unilateral": "односторонний",
	"pike": "пайк",
	"hindu": "индусские",
	"clap": "с хлопком",
	"decline": "вниз головой",
	"incline": "наклонный",
	"seated": "сидя",
	"standing": "стоя",
	"lying": "лёжа",
	"kneeling": "на коленях",
	"sitting": "сидя",
	"prone": "лёжа на животе",
	"supine": "лёжа на спине",
	"hanging": "в висе",
	"suspended": "в подвеске",
	"alternating": "поочерёдный",
	"alternate": "поочерёдный",
	"simultaneous": "одновременный",
	"cross": "крест-накрест",
	"crossed": "скрестно",
	"forward": "вперёд",
	"backward": "назад",
	"upward": "вверх",
	"downward": "вниз",
	"outward": "наружу",
	"inward": "внутрь",
	"with": "",
	"on": "",
	"and": "и",
	"to": "",
	"from": "",
	"for": "",
	"of": "",
	"the": "",
	"a": "",
	"an": "",
	"male": "",
	"female": "",
	"man": "",
	"woman": "",
	"left": "левой",
	"right": "правой",
	"both": "обеими",
	"using": "",
	"into": "",
	"out": "",
	"up": "",
	"down": "",
	"off": "",
	"in": "",
	"at": "",
	"by": "",
	"over": "",
	"under": "",
	"against": "",
	"2": "2",
	"3": "3",
	"4": "4",
	"45": "45°",
	"90": "90°",
	"180": "180°",
	"360": "360°",
	"v": "V",
	"t": "T",
	"y": "Y",
	"w": "W",
	"l": "L",
	"preacher": "Скотта",
	"concentration": "концентрированное",
	"abdominal": "пресса",
	"abductor": "абдуктора",
	"adductor": "аддуктора",
	"degrees": "градусов",
	"cossack": "казачий",
	"svend": "Свенда",
	"sphinx": "сфинкс",
	"swimmer": "пловца",
	"treadmill": "на беговой дорожке",
	"elliptical": "на эллипсе",
	"stepmill": "на степмилле",
	"staircase": "по лестнице",
	"strap": "с лямками",
	"angled": "под углом",
	"facing": "лицом",
	"dog": "собака",
	"cat": "кошка",
	"round": "круговой",
	"fallout": "отведение",
	"iso": "изо",
	"pause": "с паузой",
	"slow": "медленный",
	"fast": "быстрый",
	"dynamic": "динамический",
	"static": "статический",
	"mobility": "мобилити",
	"warmup": "разминка",
	"cooldown": "заминка",
}

PHRASES.sort(key=lambda item: len(item[0]), reverse=True)
EQUIPMENT_PREFIX.sort(key=lambda item: len(item[0]), reverse=True)


def normalize_spaces(text: str) -> str:
	text = re.sub(r"\s+", " ", text).strip(" -–—,/")
	text = re.sub(r"\s+([,.:;)])", r"\1", text)
	text = re.sub(r"([(])\s+", r"\1", text)
	text = re.sub(r"\s{2,}", " ", text)
	return text


def split_parens(name: str) -> tuple[str, str]:
	match = re.search(r"\(([^)]*)\)\s*$", name)
	if not match:
		return name, ""
	note = match.group(1).strip()
	core = name[: match.start()].strip()
	return core, note


def translate_tokens(text: str) -> str:
	text = text.lower().strip()
	text = re.sub(r"\b(male|female|man|woman)\b", " ", text)
	text = normalize_spaces(text)

	for eng, rus in PHRASES:
		text = re.sub(rf"(?<![\w-]){re.escape(eng)}(?![\w-])", rus, text)

	parts = re.findall(r"[a-z0-9°'/+-]+|[^a-z0-9°'/+\-\s]+|\s+", text)
	out: list[str] = []
	for part in parts:
		if part.isspace():
			out.append(" ")
			continue
		key = part.lower()
		if key in WORDS:
			val = WORDS[key]
			if val:
				out.append(val)
			continue
		out.append(part)
	return normalize_spaces("".join(out))


def translate_name(name: str) -> str:
	core, note = split_parens(name)
	core_l = core.lower().strip()
	core_l = re.sub(r"\b(male|female|man|woman)\b", " ", core_l)
	core_l = normalize_spaces(core_l)

	equip_ru = ""
	for eng, rus in EQUIPMENT_PREFIX:
		if core_l.startswith(eng + " ") or core_l == eng:
			equip_ru = rus
			core_l = core_l[len(eng) :].strip()
			break

	body = translate_tokens(core_l)
	note_ru = translate_tokens(note) if note else ""

	chunks = [c for c in [body, equip_ru] if c]
	result = normalize_spaces(" ".join(chunks))
	if note_ru:
		result = f"{result} ({note_ru})" if result else f"({note_ru})"
	if not result:
		result = name.strip()

	# Light post-fixes for awkward leftover English word order.
	fixes = [
		(r"^лучника отжимания\b", "отжимания лучника"),
		(r"^лучника подтягивания\b", "подтягивания лучника"),
		(r"^на грудь отжимания на брусьях\b", "отжимания на брусьях на грудь"),
		(r"^широким хватом на грудь отжимания на брусьях\b", "отжимания на брусьях широким хватом на грудь"),
		(r"^лёжа сгибание ног\b", "сгибание ног лёжа"),
		(r"^сидя сгибание ног\b", "сгибание ног сидя"),
		(r"^на коленях сгибание ног\b", "сгибание ног на коленях"),
		(r"^узким хватом жим лёжа\b", "жим лёжа узким хватом"),
		(r"^на наклонной скамье вниз жим\b", "жим на наклонной скамье вниз"),
		(r"^на наклонной скамье жим\b", "жим на наклонной скамье"),
		(r"^с хлопком отжимания\b", "отжимания с хлопком"),
		(r"^глубокие отжимания\b", "глубокие отжимания"),
		(r"\bstability мячом\b", "с фитболом"),
		(r"\b\(боковой вид\)\b", "(вид сбоку)"),
		(r"\b\(спины вид\)\b", "(вид сзади)"),
		(r"\bpov\b", "вид"),
		(r"\bнаклонный\s+", "наклонный "),
		(r"\bзадний выпад\b", "выпад назад"),
		(r"\bвыпад прыжок\b", "прыжковые выпады"),
		(r"\bвыпад скручивание\b", "выпад с поворотом"),
		(r"\bV\. 2\b", "вариант 2"),
		(r"\bв подвеске сплит-присед\b", "сплит-присед в подвеске"),
		(r"\bна одной ноге сплит-присед\b", "болгарский сплит-присед"),
	]
	for pattern, repl in fixes:
		result = re.sub(pattern, repl, result, flags=re.IGNORECASE)

	result = normalize_spaces(result)
	return result[:1].upper() + result[1:] if result else result


def main() -> None:
	index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
	overrides: dict[str, str] = {}
	if OVERRIDES_PATH.exists():
		overrides = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))

	for item in index:
		ru = translate_name(item["name"])
		oid = str(item.get("id", ""))
		if oid in overrides:
			ru = overrides[oid]
		item["name_ru"] = ru

	INDEX_PATH.write_text(
		json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
	)

	if FULL_PATH.exists():
		full = json.loads(FULL_PATH.read_text(encoding="utf-8"))
		for item in full:
			ru = translate_name(item["name"])
			oid = str(item.get("id", ""))
			if oid in overrides:
				ru = overrides[oid]
			item["name_ru"] = ru
		FULL_PATH.write_text(
			json.dumps(full, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
		)
		print(f"updated full catalog → {FULL_PATH.relative_to(ROOT)}")
	else:
		print(f"skip full catalog (missing {FULL_PATH.relative_to(ROOT)})")

	samples = [
		"archer push up",
		"assisted chest dip (kneeling)",
		"band bench press",
		"barbell bench press",
		"barbell decline bench press",
		"barbell full squat (side pov)",
		"lever lying leg curl",
		"3/4 sit-up",
		"dumbbell curl",
		"cable seated row",
		"barbell guillotine bench press",
	]
	print("samples:")
	for sample in samples:
		print(f"  {sample} -> {translate_name(sample)}")

	import re as _re

	latin = sum(1 for x in index if _re.search(r"[A-Za-z]{4,}", x["name_ru"]))
	print(f"updated {len(index)}; overrides {len(overrides)}; still have 4+ latin letters: {latin}")


if __name__ == "__main__":
	main()
