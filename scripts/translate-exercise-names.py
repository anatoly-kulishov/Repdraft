#!/usr/bin/env python3
"""Bake Russian exercise titles (name_ru) into static JSON catalogs."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "static/data/exercises.index.json"
FULL_PATH = ROOT / "data/exercises.full.json"
FULL_STATIC_PATH = ROOT / "static/data/exercises.full.json"
OVERRIDES_PATH = ROOT / "static/data/exercise-names.ru.overrides.json"
SRC_OVERRIDES_PATH = ROOT / "src/lib/data/exerciseNamesRuOverrides.json"
LATIN_SCRUB_PATH = Path(__file__).resolve().parent / "exercise-latin-scrub.json"

# Leading equipment → natural Russian adjunct (usually at the end).
# Bodyweight is omitted (gym-standard: name the movement, add the tool only when it disambiguates).
EQUIPMENT_PREFIX: list[tuple[str, str]] = [
	("olympic barbell", "с олимпийской штангой"),
	("ez barbell", "с EZ-грифом"),
	("ez bar", "с EZ-грифом"),
	("trap bar", "с трэп-грифом"),
	("smith machine", "в тренажёре Смита"),
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
	("kettlebell", "с гирей"),
	("dumbbell", "с гантелями"),
	("barbell", "со штангой"),
	("cable", "на блоке"),
	("band", "с резинкой"),
	("lever", "в рычажном тренажёре"),
	("smith", "в тренажёре Смита"),
	("ez", "с EZ-грифом"),
	("rope", "с канатом"),
	("tire", "с покрышкой"),
	("roller", "с роллером"),
	("weighted", "с отягощением"),
	("assisted", "с поддержкой"),
	("bodyweight", ""),
	("body weight", ""),
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
	("guillotine bench press", "жим «гильотина» лёжа"),
	("jm bench press", "JM-жим"),
	("close-grip bench press", "жим узким хватом лёжа"),
	("close grip bench press", "жим узким хватом лёжа"),
	("incline bench press", "жим на наклонной скамье"),
	("decline bench press", "жим на наклонной скамье вниз"),
	("bench press", "жим лёжа"),
	("shoulder press", "жим плечами"),
	("military press", "армейский жим"),
	("overhead press", "жим над головой"),
	("chest press", "жим от груди"),
	("leg press", "жим ногами"),
	("calf raise", "подъём на носки"),
	("calf raises", "подъёмы на носки"),
	("front raise", "подъём перед собой"),
	("rear lateral raise", "разведение на заднюю дельту"),
	("lateral raise", "разведение стоя"),
	("rear delt raise", "разведение на заднюю дельту"),
	("cable kneeling rear delt row", "тяга блока на заднюю дельту на коленях"),
	("cable standing rear delt row", "тяга блока на заднюю дельту стоя"),
	("cable rear delt row", "тяга блока на заднюю дельту"),
	("rear delt row", "тяга на заднюю дельту"),
	("rear delt", "заднюю дельту"),
	("straight back", "прямой спины"),
	("side bend", "наклон в сторону"),
	("side bends", "наклоны в сторону"),
	("hip thrust", "ягодичный мост"),
	("hip extension", "разгибание бедра"),
	("leg extension", "разгибание ног"),
	("leg curl", "сгибание ног"),
	("preacher curl", "сгибание на скамье Скотта"),
	("concentration curl", "концентрированное сгибание"),
	("bicep curl", "подъём на бицепс"),
	("biceps curl", "подъём на бицепс"),
	("lying triceps extension skull crusher", "французский жим лёжа"),
	("skull crusher", "французский жим лёжа"),
	("lying triceps extension", "французский жим лёжа"),
	("triceps extension", "разгибание на трицепс"),
	("face pull", "тяга к лицу"),
	("upright row", "тяга к подбородку"),
	("bent over row", "тяга в наклоне"),
	("bent-over row", "тяга в наклоне"),
	("cable low seated row", "горизонтальная тяга в блочном тренажёре"),
	("low seated row", "горизонтальная тяга в блочном тренажёре"),
	("cable seated row", "горизонтальная тяга в блочном тренажёре"),
	("seated row", "горизонтальная тяга"),
	("inverted row", "горизонтальные подтягивания"),
	("lat pulldown", "вертикальная тяга"),
	("lateral pulldown", "вертикальная тяга"),
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
	("45в°", "45°"),
	("v. 2", "вариант 2"),
	("goblet squat", "гоблет-присед"),
	("front squat", "приседания на груди"),
	("back squat", "приседания со штангой на спине"),
	("overhead squat", "присед над головой"),
	("pistol squat", "пистолетик"),
	("pistol", "пистолетик"),
	("cossack squat", "казачий присед"),
	("jump squat", "прыжковый присед"),
	("full squat", "приседания"),
	("walking lunge", "выпады в ходьбе"),
	("reverse lunge", "выпады назад"),
	("forward lunge", "выпады вперёд"),
	("lateral lunge", "выпад в сторону"),
	("curtsy lunge", "выпад крест-накрест"),
	("rear lunge", "выпады назад"),
	("step-up", "вышагивания на платформу"),
	("step up", "вышагивания на платформу"),
	("donkey kick", "отведение ноги назад"),
	("one leg donkey calf raise", "подъём на носки «ослик» на одной ноге"),
	("donkey calf raise", "подъём на носки «ослик»"),
	("fire hydrant", "подъём ноги в сторону"),
	("back extension", "разгибание спины"),
	("wrist curl", "сгибание запястий"),
	("wrist extension", "разгибание запястий"),
	("bent over", "в наклоне"),
	("bent-over", "в наклоне"),
	("bent arm", "согнутой рукой"),
	("straight arm", "прямой рукой"),
	("straight leg", "на прямой ноге"),
	("triceps pushdown", "жим к низу"),
	("reverse-grip pushdown", "жим к низу обратным хватом"),
	("reverse grip pushdown", "жим к низу обратным хватом"),
	("pushdown", "жим к низу"),
	("push-down", "жим к низу"),
	("pulldown", "вертикальная тяга"),
	("pullover", "пуловер"),
	("pull-over", "пуловер"),
	("kickback", "разгибание в наклоне"),
	("kickbacks", "разгибания в наклоне"),
	("deadlift", "становая тяга"),
	("hyperextension", "гиперэкстензия"),
	("hyper extension", "гиперэкстензия"),
	("reverse hyper extension", "обратная гиперэкстензия"),
	("reverse hyper", "обратная гиперэкстензия"),
	("jumping jack", "прыжки джекинг"),
	("jack burpee", "джек-берпи"),
	("jack jump", "джек-прыжок"),
	("anti gravity press", "антигравитационный жим"),
	("anti-gravity press", "антигравитационный жим"),
	("burpee", "берпи"),
	("thruster", "трастер"),
	("thrusters", "трастеры"),
	("superman", "супермен"),
	("woodchop", "дровосек"),
	("archer push-up", "отжимания лучника"),
	("archer push up", "отжимания лучника"),
	("chest dip", "отжимания на брусьях на грудь"),
	("wide-grip chest dip", "отжимания на брусьях широким хватом на грудь"),
	("bench dip", "отжимания от скамьи"),
	("hack squat", "гак-приседания"),
	("stability ball", "с фитболом"),
	("with stability ball", "с фитболом"),
	("medicine ball", "с медболом"),
	("bosu ball", "на босу"),
	("decline pullover", "пуловер вниз головой"),
	("decline press", "жим вниз головой"),
	("incline press", "жим на наклонной скамье"),
	("incline fly", "разведение на наклонной скамье"),
	("decline fly", "разведение вниз головой"),
	("front raise and pullover", "подъём перед собой и пуловер"),
	("guillotine", "гильотина"),
	("archer", "лучника"),
	("diamond", "алмазные"),
	("upward facing dog", "собака мордой вверх"),
	("downward facing dog", "собака мордой вниз"),
	("butterfly yoga pose", "поза бабочки"),
	("seated wide angle pose sequence", "поза широкого угла сидя"),
	("wide angle pose", "поза широкого угла"),
	("pike-to-cobra push-up", "отжимания щука-кобра"),
	("hanging pike", "складка в висе"),
	("reverse plank with leg lift", "обратная планка с подъёмом ноги"),
	("power point plank", "планка с переходом на предплечья"),
	("weighted front plank", "планка на предплечьях с отягощением"),
	("dumbbell side plank with rear fly", "боковая планка с разведением гантели назад"),
	("side-to-side toe touch", "поочерёдные касания носков"),
	("side-to-side chin", "подтягивания из стороны в сторону"),
	("pectoralis major", "большой грудной"),
	("pectoralis minor", "малой грудной"),
	("side pov", "вид сбоку"),
	("back pov", "вид сзади"),
	("front pov", "вид спереди"),
	("pallof press", "жим Паллофа"),
	("pallof", "Паллофа"),
	("straight leg raise", "подъём прямой ноги"),
	("hanging straight leg raise", "подъём прямой ноги в висе"),
	("rocking frog stretch", "растяжка лягушки с качанием"),
	("one leg calf raise", "подъём на носки на одной ноге"),
	("single leg squat", "присед на одной ноге"),
	("spine twist", "скручивание позвоночника"),
	("reverse wrist curl", "обратное сгибание запястий"),
	("kneeling push-up", "отжимания на коленях"),
	("kneeling push up", "отжимания на коленях"),
	("incline shrug", "наклонные шраги"),
	("decline shrug", "шраги вниз головой"),
	("one arm prone curl", "сгибание на бицепс одной рукой лёжа на животе"),
	("band alternating v-up", "поочерёдная V-складка с резинкой"),
	("alternating v-up", "поочерёдная V-складка"),
	("v-up", "V-складка"),
	("v sit", "V-сид"),
	("l-sit", "L-сид"),
	("leg-hip", "ног и таза"),
	("body saw", "пила корпуса"),
	("body-up", "подъём корпуса"),
	("march sit", "сит-ап в шаге"),
	("kick out sit", "скручивание с выпадом ногой"),
	("butt-ups", "подъёмы таза"),
	("butt-up", "подъём таза"),
	("big toe", "большого пальца ноги"),
	("reclining big toe pose", "поза большого пальца ноги лёжа"),
	("ski ergometer", "лыжный эргометр"),
	("ski step", "лыжный шаг"),
	("pull-in", "подтягивание коленей"),
	("elbow-to-knee", "локоть-колено"),
	("pike-to-cobra", "пайк-кобра"),
	("kettlebell windmill", "мельница с гирей"),
	("knee touch crunch", "скручивание с касанием колен"),
	# avoid «со скручиванием скручивание» from twisting + crunch/sit-up
	("twisting crunch", "скручивание с поворотом"),
	("twisting crunches", "скручивания с поворотом"),
	("twisting sit-up", "скручивания с поворотом"),
	("twisting sit up", "скручивания с поворотом"),
	("twisting chest press", "жим от груди с поворотом"),
	("twisting seated row", "горизонтальная тяга с поворотом"),
	("twisting overhead press", "жим над головой с поворотом"),
	("twisting bench press", "жим лёжа с поворотом"),
	("twisting pull", "тяга с поворотом"),
	("twisting leg hip raise", "подъём бедра с поворотом"),
	("decline crunch", "скручивания на наклонной скамье вниз"),
	("l-sit on floor", "L-сед на полу"),
	("landmine 180", "поворот штанги на 180°"),
	("lean planche", "наклонный планш"),
	("lying elbow to knee", "скручивание локоть-колено лёжа"),
	("negative crunch", "негативное скручивание"),
	("oblique crunch", "скручивание на косые"),
	("oblique crunches floor", "скручивания на косые на полу"),
	("one arm slam", "слэм одной рукой"),
	("otis up", "подъём Отиса"),
	("otis-up", "подъём Отиса"),
	("pelvic tilt", "наклон таза"),
	("cable judo flip", "бросок дзюдо на блоке"),
	("russian twist", "русское скручивание"),
	("bicycle crunch", "велосипедные скручивания"),
	("crab twist toe touch", "скручивание «краб» с касанием носков"),
	("cocoons", "коконы"),
	("bottoms-up", "упор снизу вверх"),
	("shoulder tap", "касание плеча"),
	("shoulder tap push-up", "отжимания с касанием плеча"),
	("chest tap push-up", "отжимания с касанием груди"),
	("kneeling plank tap shoulder", "боковая планка на коленях с касанием плеча"),
	("pro lat bar", "профессиональный гриф для широчайших"),
	("dip-pull-up cage", "клетка для брусьев и подтягиваний"),
	("chest pad", "упор на грудь"),
	("t-bar reverse grip row", "тяга T-грифом обратным хватом"),
	("reverse t-bar row", "обратная тяга T-грифом"),
	("t-bar row", "тяга T-грифом"),
	("t bar row", "тяга T-грифом"),
	("t bar", "T-грифом"),
	("front pulldown", "передняя тяга"),
	("high row", "высокая тяга"),
	("lateral high row", "боковая высокая тяга"),
	("lateral wide pulldown", "боковая широкая тяга"),
	("reverse grip lateral pulldown", "боковая тяга обратным хватом"),
	("lateral pulldown", "тяга верхнего блока"),
	("upper row", "верхняя тяга"),
	("narrow row", "тяга узким хватом"),
	("rear pulldown", "задняя тяга"),
	("with rope attachment", "с канатной рукоятью"),
	("cuban press", "кубинский жим"),
	("reverse grip vertical row", "вертикальная тяга обратным хватом"),
	("catch and overhead throw", "захват и бросок над головой"),
	("muscle up", "выход силой"),
	("muscle-up", "выход силой"),
	("air bike", "велосипедные скручивания"),
	("arnold press", "жим Арнольда"),
	("kipping muscle up", "выход силой с киппингом"),
	("kipping muscle-up", "выход силой с киппингом"),
	("skater hops", "прыжки конькобежца"),
	("swimmer kicks", "удары пловца"),
	("kneeling step with swing", "шаг с махами на коленях"),
	("single leg bridge with outstretched leg", "мост на одной ноге с вытянутой ногой"),
	("janda sit-up", "скручивания Янды"),
	("london bridge", "лондонский мост"),
	("push to run", "отжимание с бегом"),
	("push-up plus", "отжимания плюс"),
	("push up plus", "отжимания плюс"),
	("runners stretch", "растяжка бегуна"),
	("stalder press", "жим Шталдера"),
	("star jump", "прыжок звезда"),
	("straddle maltese", "мальтийский планш в стрэддле"),
	("straddle planche", "планш в стрэддле"),
	("tuck crunch", "скручивание в группировке"),
	("chest pass", "пас на грудь"),
	("overhead slam", "бросок над головой"),
	("multiple response", "с множественной реакцией"),
	("single response", "с одной реакцией"),
	("release", "с броском"),
	("3 point stance", "3-точечная стойка"),
	("stork stance", "поза аиста"),
	("quick feet", "быстрые ноги"),
	("short stride", "короткий шаг"),
	("full can", ""),
	("tate press", "жим Тейта"),
	("zottman curl", "сгибание Зоттмана"),
	("waiter curl", "сгибание официанта"),
	("spider curl", "сгибание «паука»"),
	("around the world", "вокруг света"),
	("hindu push-up", "индийские отжимания"),
	("hindu push up", "индийские отжимания"),
	("world greatest stretch", "лучшая растяжка в мире"),
	("gironda sternum chin", "подтягивание Жиронды к груди"),
	("gorilla chin", "подтягивание гориллы"),
	("skin the cat", "переворот на кольцах"),
	("potty squat", "присед с широкой постановкой"),
	("prisoner half crunches", "скручивания с руками за головой"),
	("prisoner squat", "присед с руками за головой"),
	("frankenstein squat", "присед Франкенштейна"),
	("renegade row", "тяга ренегата"),
	("thibaudeau kayak row", "тяга каяком"),
	("svend press", "жим Свенда"),
	("wipers", "дворники"),
	("rocky pull-up pulldown", "подтягивания с тягой"),
	("twisted leg raise", "подъём ноги с поворотом"),
	("hip raise", "подъём бедра"),
	("hip lift", "подъём бедра"),
	("hip adduction", "приведение бедра"),
	("hip stretch", "растяжка бедра"),
	("calf push stretch", "растяжка икр"),
	("calf stretch", "растяжка икр"),
	("tricep kickback", "отведение трицепса назад"),
	("triceps kickback", "отведение трицепса назад"),
	("elbow lift", "подъём локтя"),
	("groin crunch", "скручивание паховых мышц"),
	("hamstring stretch", "растяжка бицепса бедра"),
	("leg up hamstring stretch", "растяжка бицепса бедра с поднятой ногой"),
	("leg pull in", "подтягивание ног"),
	("peroneals stretch", "растяжка малоберцовых"),
	("back stretch", "растяжка спины"),
	("triceps press", "жим трицепса"),
	("triceps stretch", "растяжка трицепса"),
	("rotary calf", "ротационный подъём на носки"),
	("calf press", "жим носками"),
	("tennis ball", "теннисным мячом"),
	("inverse leg curl", "обратное сгибание ног"),
	("stiff leg good morning", "гудморнинг на прямых ногах"),
	("good morning", "гудморнинг"),
	("drag curl", "тяговое сгибание"),
	("zercher squat", "присед с грифом в локтях"),
	("pendlay row", "тяга Пендлея"),
	("skull crusher", "французский жим лёжа"),
	("skullcrusher", "французский жим лёжа"),
	("jack knife", "ножницы"),
	("jackknife", "ножницы"),
	("3/4 sit-up", "скручивания на 3/4"),
	("exercise ball", "на фитболе"),
	("balance board", "балансировка на доске"),
	("cross-over", "кроссовер"),
	("cross over", "кроссовер"),
	("cycle cross trainer", "кросс-тренажёр (велосипед)"),
	("arm slingers", "разведение рук"),
	("spider curl", "сгибание «паука»"),
	("stiff leg good morning", "гудморнинг на прямых ногах"),
	("close grip to skull press", "жим узким хватом на трицепс"),
	("decline close grip to skull press", "жим узким хватом на трицепс вниз головой"),
	("calf press on leg press", "жим носками в тренажёре жима ногами"),
	("chair squat", "присед на стуле"),
	("alternate triceps extension", "поочерёдное разгибание на трицепс"),
	("wide hand push up", "отжимания широкой постановкой рук"),
	("wide hand push-up", "отжимания широкой постановкой рук"),
	("alternate leg raise", "поочерёдный подъём ног"),
	("wrist circles", "круги запястьями"),
	("squat row", "тяга в приседе"),
	("incline row", "наклонная тяга"),
	("one arm snatch", "рывок одной рукой"),
	("wheel run", "бег с колесом"),
	("reverse grip skullcrusher", "французский жим обратным хватом"),
	("l-pull-up", "L-подтягивание"),
	("l pull-up", "L-подтягивание"),
	("l pull up", "L-подтягивание"),
	("basic toe touch", "базовое касание носков"),
	("side push-up", "боковые отжимания"),
	("side push up", "боковые отжимания"),
	("face press", "жим к лицу"),
	("face pull", "тяга к лицу"),
	("hip internal rotation", "внутренняя ротация бедра"),
	("hip external rotation", "внешняя ротация бедра"),
	("one arm standing low row", "низкая тяга одной рукой стоя"),
	("reverse preacher curl", "обратное сгибание на скамье Скотта"),
	("seated overhead triceps extension", "разгибание на трицепс над головой сидя"),
	("back wrist curl", "сгибание запястий за спиной"),
	("curl-up", "скручивание"),
	("high pulley overhead triceps extension", "разгибание на трицепс из-за головы на высоком блоке"),
	("high pulley triceps extension", "разгибание на трицепс на высоком блоке"),
	("high pulley overhead tricep extension", "разгибание на трицепс из-за головы на высоком блоке"),
	("high pulley tricep extension", "разгибание на трицепс на высоком блоке"),
	("sumo high pull", "высокая тяга сумо"),
	("hack calf raise", "подъём на носки в гакк-приседе"),
	("hack one leg calf raise", "подъём на носки в гакк-приседе на одной ноге"),
	("bradford press", "жим Брэдфорда"),
	("bradford rocky press", "жим Брэдфорда-Роки"),
	("press and pull", "жим и тяга"),
	("speed squat", "скоростной присед"),
	("narrow stance squat", "присед узкой постановкой"),
	("butterfly yoga pose", "поза бабочки"),
	("yoga pose", "поза йоги"),
	("box jump down with one leg stabilization", "прыжок с тумбы на одной ноге с удержанием"),
	("back and forth step", "шаги вперёд-назад"),
	("motion russian twist", "русское скручивание"),
	("assisted motion russian twist", "русское скручивание с поддержкой"),
	("elevator", "лифт для пресса"),
	("wind sprints", "спринты"),
	("toe touch", "касание носков"),
	("pin press", "жим с упорами"),
	("pin presses", "жим с упорами"),
	("sz-bar", "SZ-грифом"),
	("arm blaster", "бластером для рук"),
	("ez-bar", "с EZ-грифом"),
	("ez bar", "с EZ-грифом"),
	("with rope", "с канатом"),
	("with towel", "с полотенцем"),
	("v-bar", "V-грифом"),
	("v bar", "V-грифом"),
	("dead bug", "мёртвый жук"),
	("glute-ham raise", "подъём ягодиц и бицепса бедра"),
	("chin-up", "подтягивания"),
	("chin-ups", "подтягивания"),
	("pull-up", "подтягивания"),
	("pull-ups", "подтягивания"),
	("dip bar", "брусьях"),
	("two-one leg curl", "поочерёдное сгибание ног"),
	("two arm", "двумя руками"),
	("two leg", "двумя ногами"),
	("monster walk", "монстр-ходьба"),
	("dynamic chest stretch", "динамическая растяжка грудных"),
	("side lying biceps curl", "сгибание на бицепс боком лёжа"),
	("biceps leg concentration curl", "концентрированное сгибание ногой на бицепс"),
	("hip lat stretch", "растяжка бедра и широчайших"),
	("neck side stretch", "боковая растяжка шеи"),
	("side push neck stretch", "боковая растяжка шеи с жимом"),
	("side wrist pull stretch", "боковая растяжка запястий с тягой"),
	("standing lateral stretch", "боковая растяжка стоя"),
	("back pec stretch", "растяжка грудных и широчайших"),
	("back lever", "задний рычаг"),
	("barbell lying back of the head tricep extension", "разгибание трицепса из-за головы лёжа со штангой"),
	("smith back shrug", "шраги в тренажёре Смита"),
	("standing calves", "подъём на носки стоя"),
	("assisted prone lying quads stretch", "растяжка квадрицепса лёжа на животе с поддержкой"),
	("assisted prone rectus femoris stretch", "растяжка прямой мышцы бедра лёжа на животе с поддержкой"),
	("assisted side lying adductor stretch", "растяжка аддукторов лёжа на боку с поддержкой"),
	("behind head chest stretch", "растяжка грудных с руками за головой"),
	("chair leg extended stretch", "растяжка с выпрямленной ногой на стуле"),
	("chest and front of shoulder stretch", "растяжка груди и передней дельты"),
	("chest stretch with exercise ball", "растяжка грудных на фитболе"),
	("circles knee stretch", "круговая растяжка колена"),
	("exercise ball hip flexor stretch", "растяжка сгибателей бедра на фитболе"),
	("exercise ball lat stretch", "растяжка широчайших на фитболе"),
	("exercise ball lower back stretch", "растяжка низа спины на фитболе"),
	("exercise ball lying side lat stretch", "растяжка широчайших лёжа на боку на фитболе"),
	("exercise ball seated hamstring stretch", "растяжка бицепса бедра сидя на фитболе"),
	("exercise ball seated triceps stretch", "растяжка трицепса сидя на фитболе"),
	("intermediate hip flexor and quad stretch", "растяжка сгибателей бедра и квадрицепса"),
	("iron cross stretch", "растяжка «крест»"),
	("kneeling lat stretch", "растяжка широчайших на коленях"),
	("lying (side) quads stretch", "растяжка квадрицепса лёжа на боку"),
	("overhead triceps stretch", "растяжка трицепса над головой"),
	("posterior tibialis stretch", "растяжка задней большеберцовой"),
	("rear deltoid stretch", "растяжка задней дельты"),
	("roller side lat stretch", "растяжка широчайших на боку с роллером"),
	("seated lower back stretch", "растяжка низа спины сидя"),
	("seated piriformis stretch", "растяжка грушевидной сидя"),
	("side lying floor stretch", "растяжка лёжа на боку на полу"),
	("spine stretch", "растяжка позвоночника"),
	("standing calves calf stretch", "растяжка икр стоя"),
	("standing hamstring and calf stretch with strap", "растяжка бицепса бедра и икр с лямкой стоя"),
	("upper back stretch", "растяжка верха спины"),
	("assisted triceps dip (kneeling)", "отжимания на брусьях с поддержкой (на коленях)"),
	("weighted triceps dip on high parallel bars", "отжимания на высоких брусьях с отягощением"),
	("weighted tricep dips", "отжимания на брусьях с отягощением"),
	("triceps dip (bench leg)", "отжимания на трицепс от скамьи"),
	("triceps dip (between benches)", "отжимания на трицепс между скамьями"),
	("triceps dips floor", "отжимания на трицепс от пола"),
	("lever overhand triceps dip", "отжимания на брусьях прямым хватом в рычажном тренажёре"),
	("triceps dips", "отжимания на брусьях"),
	("tricep dips", "отжимания на брусьях"),
	("triceps dip", "отжимания на брусьях"),
	("biceps narrow pull-ups", "подтягивания узким хватом на бицепс"),
	("biceps pull-up", "подтягивания на бицепс"),
	("barbell standing ab rollerout", "прокат для пресса стоя со штангой"),
	("wrist rollerer", "ролик для запястий"),
	("dumbbell incline breeding", "разведение гантелей на наклонной скамье"),
	("wide grip rear pull-up", "подтягивания за голову широким хватом"),
	("rear pull-up", "подтягивания за голову"),
	("cable standing reverse grip one arm overhead tricep extension", "разгибание на трицепс одной рукой над головой обратным хватом стоя на блоке"),
	("dumbbell seated reverse grip one arm overhead tricep extension", "разгибание на трицепс одной рукой над головой обратным хватом сидя с гантелью"),
	("barbell standing overhead triceps extension", "разгибание на трицепс над головой стоя со штангой"),
	("dumbbell decline triceps extension", "разгибание на трицепс на наклонной скамье вниз с гантелями"),
	("ez barbell decline triceps extension", "разгибание на трицепс на наклонной скамье вниз с EZ-грифом"),
	("band side triceps extension", "разгибание на трицепс в сторону с резинкой"),
	("cable incline triceps extension", "разгибание на трицепс на наклонной скамье на блоке"),
	("dumbbell incline triceps extension", "разгибание на трицепс на наклонной скамье с гантелями"),
	("ez barbell incline triceps extension", "разгибание на трицепс на наклонной скамье с EZ-грифом"),
	("smith machine incline tricep extension", "разгибание на трицепс на наклонной скамье в тренажёре Смита"),
	("cable rope incline tricep extension", "разгибание на трицепс с канатом на наклонной скамье на блоке"),
	("dumbbell lying alternate extension", "поочерёдное разгибание лёжа с гантелями"),
	("cable cross-over revers fly", "обратное разведение в кроссовере"),
	("barbell revers wrist curl", "обратное сгибание запястий со штангой"),
	("dumbbell over bench revers wrist curl", "обратное сгибание запястий на скамье с гантелями"),
	("dumbbell seated bent over alternate kickback", "поочерёдное разгибание гантели в наклоне сидя"),
	("exercise ball one legged diagonal kick hamstring curl", "сгибание бицепса бедра с диагональным ударом на одной ноге на фитболе"),
	("cable standing up straight crossovers", "кроссоверы стоя на блоке"),
	("cable straight back seated row", "горизонтальная тяга сидя с прямой спиной на блоке"),
	("dumbbell straight arm pullover", "пуловер прямыми руками с гантелями"),
	("weighted straight bar dip", "отжимания на прямой перекладине с отягощением"),
	("incline push-up", "наклонные отжимания"),
	("incline push up", "наклонные отжимания"),
	("incline push-up (on box)", "наклонные отжимания (на тумбу)"),
	("incline push up depth jump", "наклонные отжимания с прыжком в глубину"),
	("narrow push-up on exercise ball", "узкие отжимания на фитболе"),
	("reverse dip", "обратные отжимания на брусьях"),
	("dumbbell incline twisted flyes", "наклонные разведения с гантелями"),
	("cable pulldown bicep curl", "подъём на бицепс на верхнем блоке"),
	("walking on incline treadmill", "ходьба под наклоном на беговой дорожке"),
	("run (equipment)", "бег на беговой дорожке"),
	("stationary bike run v. 3", "езда на велотренажёре (вариант 3)"),
	("stationary bike walk", "езда на велотренажёре в спокойном темпе"),
	("walk elliptical cross trainer", "ходьба на эллипсе"),
	("walking on stepmill", "ходьба на степмилле"),
	("lever shoulder press v. 3", "жим плечами в рычажном тренажёре (вариант 3)"),
	("run", "бег на месте"),
	("side hip abduction", "отведение бедра в сторону"),
	("side hip", "бедро боком"),
	("parallel bars", "на параллельных брусьях"),
	("bent knee legs", "с согнутыми коленями"),
	("extended range", "с увеличенной амплитудой"),
	("full range", "с полной амплитудой"),
	("range of motion", "амплитуды движения"),
	("pull-up cable machine", "в тренажёре для подтягиваний"),
	("chest push", "жим на грудь"),
	("from 3 point stance", "из 3-точечной стойки"),
	("bench seated press", "сидя жим на скамье"),
	("seated bench press", "сидя жим на скамье"),
	("exercise ball hug", "объятие фитбола"),
	("exercise ball alternating arm ups", "поочерёдный подъём рук на фитболе"),
	("hug keens to chest", "объятие коленей к груди"),
	("hug knees to chest", "объятие коленей к груди"),
	("knee hug", "объятие коленей"),
	("toe raise", "подъём на носки"),
	("spider crawl push-up", "паучьи отжимания"),
	("spider crawl push up", "паучьи отжимания"),
	("spider crawl", "паучье ползание"),
	("quads", "приседания для квадрицепса"),
	("flutter kicks", "флаттер-кики"),
	("leg-hip raise", "подъём ног и таза"),
	("reclining big toe pose with rope", "поза большого пальца ноги лёжа с канатом"),
	("hug knees to chest", "объятие коленей к груди"),
	("sledge hammer", "удары кувалдой"),
	("spell caster", "вращение корпуса с гантелями"),
	("deep push up", "глубокие отжимания"),
	("deep push-up", "глубокие отжимания"),
	("hip thrust", "ягодичный мост"),
	("hip thrusts", "ягодичный мост"),
]

WORDS: dict[str, str] = {
	"press": "жим",
	"curl": "подъём на бицепс",
	"curls": "подъёмы на бицепс",
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
	"saw": "пила",
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
	"equipment": "тренажёр",
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

LATIN_SCRUB: dict[str, str] = {}
if LATIN_SCRUB_PATH.exists():
	LATIN_SCRUB = json.loads(LATIN_SCRUB_PATH.read_text(encoding="utf-8"))


def scrub_leftover_latin(text: str) -> str:
	"""Replace leftover English tokens in a mostly-Russian title."""

	def repl(match: re.Match[str]) -> str:
		key = match.group(0).lower()
		if key in LATIN_SCRUB:
			return LATIN_SCRUB[key]
		if key in WORDS and WORDS[key]:
			return WORDS[key]
		return ""

	out = text
	for _ in range(8):
		next_out = normalize_spaces(re.sub(r"[A-Za-z]{4,}", repl, out))
		if next_out == out or not has_long_latin(next_out):
			return next_out
		out = next_out
	return out


def has_long_latin(text: str) -> bool:
	return bool(re.search(r"[A-Za-z]{4,}", text))


def normalize_spaces(text: str) -> str:
	text = re.sub(r"\s+", " ", text).strip(" -–—,/")
	text = re.sub(r"\s+([,.:;)])", r"\1", text)
	text = re.sub(r"([(])\s+", r"\1", text)
	# Compound prefixes from latin scrub ("джек-", "анти-", "гипер-"): drop space after hyphen.
	# Keep "слово - слово" (spaces on both sides) as a separator.
	text = re.sub(r"(?<=\S)-\s+(?=\S)", "-", text)
	text = re.sub(r"\s{2,}", " ", text)
	return text


# Acronyms that must keep their case after phrase substitution (JM-жим, EZ-гриф, …).
ACRONYM_CANON: dict[str, str] = {
	"JM": "JM",
	"EZ": "EZ",
	"SZ": "SZ",
	"V": "V",
	"T": "T",
	"W": "W",
	"Y": "Y",
}
_ACRONYM_RE = re.compile(r"\b(?:JM|EZ|SZ|[VTWY])(?=-|\b)", re.IGNORECASE)


def lower_preserving_acronyms(text: str) -> str:
	parts: list[str] = []
	i = 0
	for match in _ACRONYM_RE.finditer(text):
		parts.append(text[i : match.start()].lower())
		parts.append(ACRONYM_CANON[match.group(0).upper()])
		i = match.end()
	parts.append(text[i:].lower())
	return "".join(parts)


def only_protected_latin(text: str) -> bool:
	stripped = _ACRONYM_RE.sub("", text)
	return not re.search(r"[A-Za-z]", stripped)


def split_parens(name: str) -> tuple[str, str]:
	match = re.search(r"\(([^)]*)\)\s*$", name)
	if not match:
		return name, ""
	note = match.group(1).strip()
	core = name[: match.start()].strip()
	return core, note


def translate_tokens(text: str) -> str:
	text = lower_preserving_acronyms(text).strip()
	text = re.sub(r"\b(male|female|man|woman)\b", " ", text)
	text = normalize_spaces(text)

	for eng, rus in PHRASES:
		text = re.sub(rf"(?<![\w-]){re.escape(eng)}(?![\w-])", rus, text)

	parts = re.findall(r"[A-Za-z0-9°'/+-]+|[^A-Za-z0-9°'/+\-\s]+|\s+", text)
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
		canon = ACRONYM_CANON.get(part.upper())
		if canon and part.upper() in ACRONYM_CANON:
			out.append(canon)
			continue
		out.append(part)
	return normalize_spaces("".join(out))


def _apply_phrases(text: str) -> str:
	for eng, rus in PHRASES:
		text = re.sub(rf"(?<![\w-]){re.escape(eng)}(?![\w-])", rus, text)
	return text


def translate_name(name: str) -> str:
	# Full-title phrases first (e.g. "run (equipment)") before paren split.
	full_l = normalize_spaces(lower_preserving_acronyms(name).strip())
	full_l = re.sub(r"\b(male|female|man|woman)\b", " ", full_l)
	full_l = normalize_spaces(full_l)
	for eng, rus in PHRASES:
		if full_l == eng:
			result = rus
			if result:
				result = result[:1].upper() + result[1:]
			return result

	core, note = split_parens(name)
	core_l = core.lower().strip()
	core_l = re.sub(r"\b(male|female|man|woman)\b", " ", core_l)
	core_l = normalize_spaces(core_l)

	# Gym phrases first so "cable seated row" is not split into "seated row" + "на блоке".
	phrased = _apply_phrases(core_l)

	equip_ru = ""
	for eng, rus in EQUIPMENT_PREFIX:
		if phrased.startswith(eng + " ") or phrased == eng:
			equip_ru = rus
			phrased = phrased[len(eng) :].strip()
			break

	if re.search(r"[A-Za-z]", phrased) and not only_protected_latin(phrased):
		body = translate_tokens(phrased)
	else:
		body = phrased
	note_ru = translate_tokens(note) if note else ""
	# движение → позиция → снаряд: "сидя жим плечами" + "в Смите" → "жим плечами сидя в Смите"
	body = re.sub(
		r"^(сидя|стоя|лёжа|на коленях)\s+(.+)$",
		lambda m: f"{m.group(2)} {m.group(1).lower()}",
		body,
		flags=re.IGNORECASE,
	)

	# Avoid doubling "на блоке" when the body already mentions a block/pulley.
	if equip_ru == "на блоке" and re.search(r"\b(блоке|блока|блочном)\b", body):
		equip_ru = ""
	chunks = [c for c in [body, equip_ru] if c]
	result = normalize_spaces(" ".join(chunks))

	# Fix common Russian word-order inversions (adjective/body-part before action).
	body_parts = (
		"спин[аеиуыо]*|груд[ьияе]*|плеч[аеиоу]*|ше[ийюя]*|бедр[аеоу]*|ягодиц[аеы]*|"
		"икр[аы]*|колен[ейяю]*|запястий|предплечий|трицепс[аеу]*|бицепс[аеу]*|"
		"квадрицепс[аеу]*|пах[ау]*|корпус[аеу]*|таз[ауо]*|пресса?|кор[аеу]*|"
		"ног[аеиоу]*|рук[аеиоу]*|локт[ейяю]*|голов[аеыу]*|кист[ейяю]*|стоп[аы]*|"
		"большого пальца ноги|дельт[аы]*"
	)
	adjectives = (
		"задн[иеях]+|передн[иеях]+|боков[аяые]+|верхн[иеях]+|нижн[иеях]+|"
		"внутренн[иеях]+|внешн[иеях]+|прям[аяыеой]+|согнут[аяыеой]+|"
		"обратн[аяыеой]+|низк[ийаяое]+|высок[ийаяое]+|горизонтальн[аяые]+|"
		"вертикальн[аяые]+|диагональн[аяые]+|боком|лёжа|сидя|стоя|на коленях"
	)
	actions = "подъём|подъёмы|разгибание|сгибание|жим|тяга|разведение|скручивание|скручивания|растяжка|мост|планка|присед|приседания|выпад|выпады|отведение|приведение|ротация|удар|удары|ходьба|бег|прыжок|прыжки|махи|бросок|прокат|пила|касание"
	# "задние дельты подъём" -> "подъём задних дельт"
	result = re.sub(
		rf"\b({adjectives})\s+({body_parts})\s+({actions})\b",
		lambda m: f"{m.group(3)} {m.group(1)} {m.group(2)}",
		result,
		flags=re.IGNORECASE,
	)
	# "спины сгибание" -> "сгибание спины"
	result = re.sub(
		rf"\b({body_parts})\s+({actions})\b",
		lambda m: f"{m.group(2)} {m.group(1)}",
		result,
		flags=re.IGNORECASE,
	)
	# "шеи боковой растяжка" -> "растяжка боковой шеи" (gender fixed below)
	result = re.sub(
		rf"\b({body_parts})\s+({adjectives})\s+({actions})\b",
		lambda m: f"{m.group(3)} {m.group(2)} {m.group(1)}",
		result,
		flags=re.IGNORECASE,
	)
	result = normalize_spaces(result)
	if note_ru:
		result = f"{result} ({note_ru})" if result else f"({note_ru})"
	if not result:
		result = name.strip()

	# Light post-fixes for awkward leftover English word order.
	fixes = [
		(r"^С EZ-грифом узким хватом (.+)", r"\1 узким хватом с EZ-грифом"),
		(r"^С EZ-грифом (.+)", r"\1 с EZ-грифом"),
		(r"^С SZ-грифом (.+)", r"\1 со SZ-грифом"),
		(r"^С V-грифом (.+)", r"\1 с V-грифом"),
		(r"^С грифом (.+)", r"\1 с грифом"),
		(r"^лучника отжимания\b", "отжимания лучника"),
		(r"^лучника подтягивания\b", "подтягивания лучника"),
		(r"^Арнольда жим\b", "Жим Арнольда"),
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
		(r"боковой тяга", "боковая тяга"),
		(r"боковой растяжка", "боковая растяжка"),
		(r"боковой разгибание", "боковое разгибание"),
		(r"растяжка боковой шеи", "боковая растяжка шеи"),
		(r"растяжка боковая шеи", "боковая растяжка шеи"),
		(r"^шеи боковая растяжка\b", "боковая растяжка шеи"),
		(r"^шеи боковой растяжка\b", "боковая растяжка шеи"),
		(r"^трицепса отжимания на брусьях\b", "отжимания на брусьях"),
		(r"^бицепса подтягивания\b", "подтягивания на бицепс"),
		(r"^бицепса узкий подтягивания\b", "подтягивания узким хватом на бицепс"),
		(r"^пресса прокат\b", "прокат для пресса"),
		(r"^запястий ролик\b", "ролик для запястий"),
		(r"^позвоночника растяжка\b", "растяжка позвоночника"),
		(r"^над головой разгибание на трицепс\b", "разгибание на трицепс над головой"),
		(r"^над головой растяжка трицепса\b", "растяжка трицепса над головой"),
		(r"^вниз головой разгибание на трицепс\b", "разгибание на трицепс на наклонной скамье вниз"),
		(r"\bобратный сгибание\b", "обратное сгибание"),
		(r"\bнаклонный разгибание\b", "наклонное разгибание"),
		(r"\bнаклонный разведение\b", "наклонное разведение"),
		(r"\bпоочерёдный разгибание\b", "поочерёдное разгибание"),
		(r"\bобратный разведение\b", "обратное разведение"),
		(r"\bзадний подтягивания\b", "подтягивания за голову"),
		(r"\bзадний растяжка дельты\b", "растяжка задней дельты"),
		(r"\bверхний растяжка спины\b", "растяжка верха спины"),
		(r"\bнижний растяжка спины\b", "растяжка низа спины"),
		(r"для растяжка\b", "для растяжки"),
		(r"на растяжка\b", "растяжка"),
		(r"наклонный отжимания", "наклонные отжимания"),
		(r"узкий отжимания", "узкие отжимания"),
		(r"обратный отжимания", "обратные отжимания"),
		(r"наклонный разведения", "наклонные разведения"),
		(r"наклонный разведение", "наклонное разведение"),
		(r"^Вертикальная тяга подъём на бицепс\b", "Подъём на бицепс на верхнем блоке"),
		(r"^вертикальная тяга подъём на бицепс\b", "подъём на бицепс на верхнем блоке"),
		(r"верхний тяга", "верхняя тяга"),
		(r"нижний тяга", "нижняя тяга"),
		(r"задний тяга", "задняя тяга"),
		(r"передний тяга", "передняя тяга"),
		(r"узкий тяга", "узкая тяга"),
		(r"низкий тяга", "низкая тяга"),
		(r"поочерёдный тяга", "поочерёдная тяга"),
		(r"односторонний тяга", "односторонняя тяга"),
		(r"ротационный тяга", "ротационная тяга"),
		(r"кубинское жим", "кубинский жим"),
		(r"молотковый сгибание", "молотковое сгибание"),
		(r"наклонный сгибание", "наклонное сгибание"),
		(r"обратный сгибание", "обратное сгибание"),
		(r"поочерёдный сгибание", "поочерёдное сгибание"),
		(r"внутренний сгибание", "внутреннее сгибание"),
		(r"обратный разведение", "обратное разведение"),
		(r"наклонный разведение", "наклонное разведение"),
		(r"задний разведение", "заднее разведение"),
		(r"обратный скручивание", "обратное скручивание"),
		(r"боковой скручивание", "боковое скручивание"),
		(r"со скручиванием скручивания", "скручивания с поворотом"),
		(r"со скручиванием скручивание", "скручивание с поворотом"),
		(r"наклонный скручивания с поворотом", "наклонные скручивания с поворотом"),
		(r"^Наклонный скручивания", "Наклонные скручивания"),
		(r"^наклонный скручивания", "наклонные скручивания"),
		(r"с канатом рукоятью", "с канатной рукоятью"),
		(r"сидя широкий под углом поза", "поза широкого угла сидя"),
		(r"осла подъём на носки", "подъём на носки «ослик»"),
		(r"\bв машине Смита\b", "в тренажёре Смита"),
		(r"\bмахи в стороны\b", "разведение стоя"),
		(r"\bмахи на заднюю дельту\b", "разведение на заднюю дельту"),
		(r"^тяга верхнего блока\b", "вертикальная тяга"),
		(r"^тяга нижнего блока сидя\b", "горизонтальная тяга в блочном тренажёре"),
		(r"^разгибание на трицепс на блоке\b", "жим к низу в блочном тренажёре"),
		(r"^разгибание вниз на блоке\b", "жим к низу в блочном тренажёре"),
		(r"\bкнизу\b", "к низу"),
		(r"^фронтальный присед\b", "приседания на груди"),
		(r"^присед со штангой\b", "приседания со штангой"),
		(r"^приседания на груди со штангой\b", "приседания со штангой на груди"),
		(r"^присед в тренажёре Смита\b", "приседания в тренажёре Смита"),
		(r"^гакк-присед\b", "гак-приседания"),
		(r"^подъём на бицепс со штангой\b", "подъём штанги на бицепс стоя"),
		(r"^сгибание на бицепс со штангой\b", "подъём штанги на бицепс стоя"),
		(r"^жим лёжа со штангой\b", "жим штанги лёжа"),
		(r"^жим лёжа узким хватом со штангой\b", "жим штанги узким хватом лёжа"),
		(r"^жим лёжа на наклонной скамье со штангой\b", "жим штанги на наклонной скамье"),
		(r"^жим лёжа на наклонной скамье вниз со штангой\b", "жим штанги на наклонной скамье вниз"),
		(r"^жим лёжа с гантелями\b", "жим гантелей лёжа"),
		(r"^жим на наклонной скамье с гантелями\b", "жим гантелей на наклонной скамье"),
		(r"^жим на наклонной скамье вниз с гантелями\b", "жим гантелей на наклонной скамье вниз"),
		(r"^разведение стоя с гантелями\b", "разведение гантелей стоя"),
		(r"^подъём перед собой с гантелями\b", "подъём гантелей перед собой"),
		(r"^жим к низу на блоке\b", "жим к низу в блочном тренажёре"),
		(r"^жим к низу обратным хватом на блоке\b", "жим к низу обратным хватом в блочном тренажёре"),
		(r"^жим к низу с канатом на блоке\b", "жим к низу с канатом в блочном тренажёре"),
		(r"^становая тяга со штангой\b", "становая тяга"),
		(r"^тяга в наклоне со штангой\b", "тяга штанги в наклоне"),
		(r"^тяга в наклоне с гантелями\b", "тяга гантели одной рукой в наклоне"),
		(r"^тяга к подбородку со штангой\b", "тяга штанги к подбородку"),
		(r"^выпад со штангой\b", "выпады со штангой"),
		(r"^выпады назад со штангой\b", "выпады назад со штангой"),
		(r"^выпад назад со штангой\b", "выпады назад со штангой"),
	]
	for pattern, repl in fixes:
		result = re.sub(pattern, repl, result, flags=re.IGNORECASE)

	result = scrub_leftover_latin(result)
	result = normalize_spaces(result)
	# Preserve leading acronyms (JM-жим), only title-case plain Cyrillic starts.
	if result:
		if _ACRONYM_RE.match(result):
			pass
		else:
			result = result[:1].upper() + result[1:]
	return result


def resolve_ru_name(name: str, override: str | None = None) -> str:
	if override:
		return override
	ru = translate_name(name)
	if not has_long_latin(ru):
		return ru
	# Retry: translate full English title without equipment split.
	body = translate_tokens(name)
	body = scrub_leftover_latin(body)
	if body and not has_long_latin(body):
		if _ACRONYM_RE.match(body):
			return body
		return body[:1].upper() + body[1:]
	# Last resort: drop unknown English tokens, keep Russian skeleton.
	stripped = scrub_leftover_latin(ru)
	stripped = normalize_spaces(re.sub(r"[A-Za-z]{4,}", " ", stripped))
	if stripped and re.search(r"[а-яё]", stripped, re.IGNORECASE):
		if _ACRONYM_RE.match(stripped):
			return stripped
		return stripped[:1].upper() + stripped[1:]
	return ru


# Delavier / powermens canonical titles. Win over generated calques.
GYM_STANDARD_OVERRIDES: dict[str, str] = {
	# Abs / misc
	"0003": "Велосипедные скручивания",
	"0001": "Скручивания на 3/4",
	"0277": "Скручивания на наклонной скамье вниз",
	"1001": "Сплит-присед с резинкой",
	# Chest
	"0025": "Жим штанги лёжа",
	"0030": "Жим штанги узким хватом лёжа",
	"0055": "Жим штанги узким хватом лёжа (другой ракурс)",
	"0033": "Жим штанги на наклонной скамье вниз",
	"0047": "Жим штанги на наклонной скамье",
	"0045": "Жим штанги лёжа «гильотина»",
	"0289": "Жим гантелей лёжа",
	"0314": "Жим гантелей на наклонной скамье",
	"0301": "Жим гантелей на наклонной скамье вниз",
	"0308": "Разведение гантелей лёжа",
	"0319": "Разведение гантелей на наклонной скамье",
	"1275": "Отжимания с возвышения",
	"0129": "Отжимания от скамьи",
	"0251": "Отжимания на брусьях на грудь",
	# Arms / triceps / biceps
	"0052": "JM-жим со штангой",
	"0450": "JM-жим с EZ-грифом",
	"0060": "Французский жим лёжа",
	"0061": "Французский жим лёжа (другой ракурс)",
	"0351": "Французский жим лёжа с гантелями",
	"0453": "Французский жим с EZ-штангой сидя",
	"1749": "Французский жим с EZ-штангой стоя",
	"0201": "Жим к низу в блочном тренажёре",
	"0200": "Жим к низу с канатом в блочном тренажёре",
	"0241": "Жим к низу с V-грифом в блочном тренажёре",
	"0207": "Жим к низу одной рукой обратным хватом",
	"1723": "Жим к низу одной рукой в блочном тренажёре",
	"0031": "Подъём штанги на бицепс стоя",
	"0447": "Подъём EZ-штанги на бицепс стоя",
	"0285": "Поочерёдный подъём гантелей на бицепс",
	"0313": "Молотковые сгибания с гантелями",
	"0814": "Отжимания на брусьях на трицепс",
	# Legs
	"0043": "Приседания со штангой",
	"0042": "Приседания со штангой на груди",
	"0770": "Приседания в тренажёре Смита",
	"3281": "Полные приседания в тренажёре Смита",
	"3142": "Сумо-приседания в тренажёре Смита",
	"1433": "Приседания со штангой на груди в тренажёре Смита",
	"0046": "Гак-приседания со штангой",
	"0743": "Гак-приседания",
	"0755": "Гак-приседания в тренажёре Смита",
	"0739": "Жим ногами",
	"0054": "Выпады со штангой",
	"0078": "Выпады назад со штангой",
	"0077": "Выпады назад со штангой (другой ракурс)",
	"1460": "Выпады в ходьбе",
	"0585": "Разгибания ног",
	"0586": "Сгибание ног лёжа",
	"0599": "Сгибание ног сидя",
	"1760": "Гоблет-присед с гантелью",
	# Back
	"0032": "Становая тяга",
	"0085": "Румынская тяга со штангой",
	"0027": "Тяга штанги в наклоне",
	"0293": "Тяга гантели одной рукой в наклоне",
	"0606": "Тяга Т-штанги",
	"0652": "Подтягивания на перекладине",
	"1326": "Подтягивания обратным хватом",
	"0150": "Вертикальная тяга широким хватом",
	"2330": "Вертикальная тяга с полной амплитудой",
	"0245": "Вертикальная тяга обратным хватом",
	"0198": "Вертикальная тяга",
	"0180": "Горизонтальная тяга в блочном тренажёре",
	"0861": "Горизонтальная тяга в блочном тренажёре (другой ракурс)",
	"0238": "Пуловер в блочном тренажёре стоя",
	"0237": "Пуловер с канатом в блочном тренажёре стоя",
	# Delts / traps
	"0334": "Разведение гантелей стоя",
	"0396": "Разведение гантелей сидя",
	"0395": "Разведение гантелей сидя (другой ракурс)",
	"0310": "Подъём гантелей перед собой",
	"0380": "Разведение гантелей в наклоне",
	"2292": "Разведение гантелей в наклоне (другой ракурс)",
	"0178": "Разведение на блоке стоя",
	"2137": "Жим Арнольда",
	"0287": "Жим Арнольда (другой ракурс)",
	"0523": "Жим Арнольда с гирей",
	"0091": "Жим штанги сидя",
	"1456": "Армейский жим узким хватом стоя",
	"1457": "Жим штанги стоя (армейский жим)",
	"0095": "Шраги со штангой",
	"0406": "Шраги с гантелями",
	"0120": "Тяга штанги к подбородку",
	"0119": "Тяга штанги к подбородку (другой ракурс)",
	"0121": "Тяга штанги к подбородку (вариант 3)",
	"0203": "Тяга блока на заднюю дельту",
	"0202": "Тяга блока на заднюю дельту (стремена)",
	"0233": "Тяга блока на заднюю дельту стоя",
	"3697": "Тяга блока на заднюю дельту на коленях",
	# Abs (powermens)
	"0872": "Обратные скручивания",
	"0472": "Подъёмы ног в висе",
	"0011": "Подъёмы коленей в висе с поддержкой",
	# Good mornings / smith press
	"0044": "Гудморнинг",
	"0090": "Гудморнинг сидя",
	"0115": "Гудморнинг на прямых ногах",
	"0749": "Гудморнинг в тренажёре Смита",
	"0765": "Жим штанги сидя в тренажёре Смита",
	"0766": "Жим штанги сидя в тренажёре Смита (другой ракурс)",
	"3759": "Гудморнинг сидя в рычажном тренажёре",
	"1489": "Сисси-присед",
	# Stretch / calisthenics / token-glue name salad
	"1403": "Боковая растяжка шеи",
	"0794": "Боковая растяжка стоя",
	"1405": "Растяжка грудных и широчайших",
	"3297": "Задний рычаг",
	"1720": "Разгибание трицепса из-за головы лёжа со штангой",
	"0746": "Шраги в тренажёре Смита",
	"1397": "Подъём на носки стоя",
	"1713": "Растяжка квадрицепса лёжа на животе с поддержкой",
	"1714": "Растяжка прямой мышцы бедра лёжа на животе с поддержкой",
	"1712": "Растяжка аддукторов лёжа на боку с поддержкой",
	"1259": "Растяжка грудных с руками за головой",
	"1548": "Растяжка с выпрямленной ногой на стуле",
	"1271": "Растяжка груди и передней дельты",
	"1272": "Растяжка грудных на фитболе",
	"0257": "Круговая растяжка колена",
	"1559": "Растяжка сгибателей бедра на фитболе",
	"1339": "Растяжка широчайших на фитболе",
	"1341": "Растяжка низа спины на фитболе (пирамида)",
	"1342": "Растяжка широчайших лёжа на боку на фитболе",
	"1560": "Растяжка бицепса бедра сидя на фитболе",
	"1745": "Растяжка трицепса сидя на фитболе",
	"1564": "Растяжка сгибателей бедра и квадрицепса",
	"1419": "Растяжка «крест»",
	"1346": "Растяжка широчайших на коленях",
	"0613": "Растяжка квадрицепса лёжа на боку",
	"0643": "Растяжка трицепса над головой",
	"1389": "Растяжка задней большеберцовой",
	"0669": "Растяжка задней дельты",
	"2207": "Растяжка широчайших на боку с роллером",
	"0690": "Растяжка низа спины сидя",
	"2567": "Растяжка грушевидной сидя",
	"1358": "Растяжка лёжа на боку на полу",
	"1363": "Растяжка позвоночника",
	"1398": "Растяжка икр стоя",
	"1599": "Растяжка бицепса бедра и икр с лямкой стоя",
	"1365": "Растяжка верха спины",
	"0019": "Отжимания на брусьях с поддержкой (на коленях)",
	"0812": "Отжимания на трицепс от скамьи",
	"0813": "Отжимания на трицепс между скамьями",
	"0815": "Отжимания на трицепс от пола",
	"1755": "Отжимания на брусьях с отягощением",
	"1767": "Отжимания на высоких брусьях с отягощением",
	"0591": "Отжимания на брусьях прямым хватом в рычажном тренажёре",
	"0139": "Подтягивания узким хватом на бицепс",
	"0140": "Подтягивания на бицепс",
	"0670": "Подтягивания за голову",
	"1367": "Подтягивания за голову широким хватом",
	"0103": "Прокат для пресса стоя со штангой",
	"0859": "Ролик для запястий",
	"0109": "Разгибание на трицепс над головой стоя со штангой",
	"0306": "Разгибание на трицепс на наклонной скамье вниз с гантелями",
	"2186": "Разгибание на трицепс на наклонной скамье вниз с EZ-грифом",
	"0998": "Разгибание на трицепс в сторону с резинкой",
	"0173": "Разгибание на трицепс на наклонной скамье на блоке",
	"0330": "Разгибание на трицепс на наклонной скамье с гантелями",
	"0449": "Разгибание на трицепс на наклонной скамье с EZ-грифом",
	"1752": "Разгибание на трицепс на наклонной скамье в тренажёре Смита",
	"1725": "Разгибание на трицепс с канатом на наклонной скамье на блоке",
	"1727": "Разгибание на трицепс одной рукой над головой обратным хватом стоя на блоке",
	"1738": "Разгибание на трицепс одной рукой над головой обратным хватом сидя с гантелью",
	"1729": "Поочерёдное разгибание лёжа с гантелями",
	"1730": "Поочерёдное разгибание гантели в наклоне сидя",
	"0316": "Разведение гантелей на наклонной скамье",
	"0154": "Обратное разведение в кроссовере",
	"0079": "Обратное сгибание запястий вариант 2 со штангой",
	"0368": "Обратное сгибание запястий на скамье с гантелями",
	"1417": "Сгибание бицепса бедра с диагональным ударом на одной ноге на фитболе",
	"1269": "Кроссоверы стоя на блоке",
	"0239": "Горизонтальная тяга сидя с прямой спиной на блоке",
	"0433": "Пуловер прямыми руками с гантелями",
	"3313": "Отжимания на прямой перекладине с отягощением",
	"0493": "Наклонные отжимания",
	"3785": "Наклонные отжимания (на тумбу)",
	"0492": "Наклонные отжимания с прыжком в глубину",
	"2328": "Узкие отжимания на фитболе",
	"0672": "Обратные отжимания на брусьях",
	"0331": "Наклонные разведения с гантелями",
	"1638": "Подъём на бицепс на верхнем блоке",
	"3666": "Ходьба под наклоном на беговой дорожке",
	"0684": "Бег на беговой дорожке",
	"0685": "Бег на месте",
	"2138": "Езда на велотренажёре (вариант 3)",
	"0798": "Езда на велотренажёре в спокойном темпе",
	"2141": "Ходьба на эллипсе",
	"2311": "Ходьба на степмилле",
	"2318": "Жим плечами в рычажном тренажёре (вариант 3)",
	# Delavier OCR gaps
	"0297": "Концентрированное сгибание одной руки",
	"0070": "Сгибание рук на скамье Скотта со штангой",
	"0372": "Сгибание рук на скамье Скотта с гантелью",
	"0073": "Пуловер со штангой",
	"0375": "Пуловер с гантелью",
	"0086": "Жим штанги из-за головы сидя",
	"0662": "Отжимания от пола",
	"0284": "Подъёмы на носки в наклоне",
	"1253": "Подъёмы на носки в наклоне в тренажёре",
	"0599": "Сгибание ног сидя",
	"0311": "Разведение гантелей стоя (большой палец вверх)",
	"0294": "Подъём гантелей на бицепс",
	"1411": "Сгибание запястий со штангой хватом сверху",
	"1412": "Сгибание запястий со штангой хватом снизу",
}


def main() -> None:
	index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
	overrides: dict[str, str] = {}
	if OVERRIDES_PATH.exists():
		overrides = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
	if SRC_OVERRIDES_PATH.exists():
		src = json.loads(SRC_OVERRIDES_PATH.read_text(encoding="utf-8"))
		overrides = {**src, **overrides}
	overrides = {**overrides, **GYM_STANDARD_OVERRIDES}

	for item in index:
		oid = str(item.get("id", ""))
		item["name_ru"] = resolve_ru_name(item["name"], overrides.get(oid))
		if has_long_latin(item["name_ru"]):
			stripped = normalize_spaces(re.sub(r"[A-Za-z]{4,}", " ", item["name_ru"]))
			if stripped and re.search(r"[а-яё]", stripped, re.IGNORECASE):
				item["name_ru"] = stripped[:1].upper() + stripped[1:]
		if has_long_latin(item["name_ru"]) and oid not in overrides:
			auto = resolve_ru_name(item["name"])
			auto = normalize_spaces(re.sub(r"[A-Za-z]{4,}", " ", auto))
			if auto and re.search(r"[а-яё]", auto, re.IGNORECASE):
				item["name_ru"] = auto[:1].upper() + auto[1:]
				overrides[oid] = item["name_ru"]

	INDEX_PATH.write_text(
		json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
	)

	if FULL_PATH.exists():
		full = json.loads(FULL_PATH.read_text(encoding="utf-8"))
		for item in full:
			oid = str(item.get("id", ""))
			item["name_ru"] = resolve_ru_name(item["name"], overrides.get(oid))
			if has_long_latin(item["name_ru"]):
				stripped = normalize_spaces(re.sub(r"[A-Za-z]{4,}", " ", item["name_ru"]))
				if stripped and re.search(r"[а-яё]", stripped, re.IGNORECASE):
					item["name_ru"] = stripped[:1].upper() + stripped[1:]
		payload = json.dumps(full, ensure_ascii=False, separators=(",", ":")) + "\n"
		FULL_PATH.write_text(payload, encoding="utf-8")
		print(f"updated full catalog → {FULL_PATH.relative_to(ROOT)}")
		if FULL_STATIC_PATH.exists():
			FULL_STATIC_PATH.write_text(payload, encoding="utf-8")
			print(f"synced full catalog → {FULL_STATIC_PATH.relative_to(ROOT)}")
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
		"cable low seated row",
		"barbell good morning",
		"barbell lying triceps extension skull crusher",
		"cable rear delt row (with rope)",
		"dumbbell lateral raise",
		"air bike",
		"dumbbell arnold press",
		"smith seated shoulder press",
		"barbell guillotine bench press",
	]
	print("samples:")
	for sample in samples:
		print(f"  {sample} -> {translate_name(sample)}")

	import re as _re

	latin = sum(1 for x in index if _re.search(r"[A-Za-z]{4,}", x["name_ru"]))
	print(f"updated {len(index)}; overrides {len(overrides)}; still have 4+ latin letters: {latin}")
	print("naming rubric: .cursor/skills/ru-gym-names/SKILL.md")

	if overrides:
		payload = json.dumps(overrides, ensure_ascii=False, indent="\t") + "\n"
		OVERRIDES_PATH.write_text(payload, encoding="utf-8")
		SRC_OVERRIDES_PATH.write_text(payload, encoding="utf-8")
		print(f"synced overrides → {OVERRIDES_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
	main()
