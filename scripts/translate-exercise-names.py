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
SRC_OVERRIDES_PATH = ROOT / "src/lib/data/exerciseNamesRuOverrides.json"
LATIN_SCRUB_PATH = Path(__file__).resolve().parent / "exercise-latin-scrub.json"

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
	("ez bar", "с EZ-грифом"),
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
	("rear delt raise", "подъём задних дельт"),
	("rear delt row", "тяга задних дельт"),
	("rear delt", "задние дельты"),
	("straight back", "прямой спины"),
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
	("45в°", "45°"),
	("v. 2", "вариант 2"),
	("goblet squat", "гоблет-присед"),
	("front squat", "фронтальный присед"),
	("back squat", "присед со штангой на спине"),
	("overhead squat", "присед над головой"),
	("pistol squat", "пистолетик"),
	("pistol", "пистолетик"),
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
	("pushdown", "разгибание вниз"),
	("push-down", "разгибание вниз"),
	("pulldown", "тяга"),
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
	("full squat", "присед"),
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
	("bicycle crunch", "велосипедное скручивание"),
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
	("low seated row", "низкая тяга сидя"),
	("rear pulldown", "задняя тяга"),
	("with rope attachment", "с канатной рукоятью"),
	("cuban press", "кубинский жим"),
	("reverse grip vertical row", "вертикальная тяга обратным хватом"),
	("catch and overhead throw", "захват и бросок над головой"),
	("muscle up", "выход силой"),
	("muscle-up", "выход силой"),
	("air bike", "велосипед с вентилятором"),
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
	("triceps pushdown", "разгибание на трицепс"),
	("inverse leg curl", "обратное сгибание ног"),
	("good morning", "наклон корпуса"),
	("drag curl", "тяговое сгибание"),
	("zercher squat", "присед с грифом в локтях"),
	("pendlay row", "тяга Пендлея"),
	("skull crusher", "французский жим"),
	("skullcrusher", "французский жим"),
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
	("stiff leg good morning", "наклон корпуса на прямых ногах"),
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
	("jm bench press", "JM-жим лёжа"),
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
	("side push neck stretch", "боковая растяжка шеи с жимом"),
	("side wrist pull stretch", "боковая растяжка запястий с тягой"),
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
	"curl": "сгибание на бицепс",
	"curls": "сгибания на бицепс",
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

	# Avoid doubling "на блоке" when the body already mentions a block/pulley.
	if equip_ru == "на блоке" and re.search(r"\b(блоке|блока)\b", body):
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
		(r"с канатом рукоятью", "с канатной рукоятью"),
		(r"сидя широкий под углом поза", "поза широкого угла сидя"),
		(r"осла подъём на носки", "подъём на носки «ослик»"),
	]
	for pattern, repl in fixes:
		result = re.sub(pattern, repl, result, flags=re.IGNORECASE)

	result = scrub_leftover_latin(result)
	result = normalize_spaces(result)
	return result[:1].upper() + result[1:] if result else result


def resolve_ru_name(name: str, override: str | None = None) -> str:
	if override:
		return override
	ru = translate_name(name)
	if not has_long_latin(ru):
		return ru
	# Retry: translate full English title without equipment split.
	body = translate_tokens(name.lower())
	body = scrub_leftover_latin(body)
	if body and not has_long_latin(body):
		return body[:1].upper() + body[1:]
	# Last resort: drop unknown English tokens, keep Russian skeleton.
	stripped = scrub_leftover_latin(ru)
	stripped = normalize_spaces(re.sub(r"[A-Za-z]{4,}", " ", stripped))
	if stripped and re.search(r"[а-яё]", stripped, re.IGNORECASE):
		return stripped[:1].upper() + stripped[1:]
	return ru


def main() -> None:
	index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
	overrides: dict[str, str] = {}
	if OVERRIDES_PATH.exists():
		overrides = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
	if SRC_OVERRIDES_PATH.exists():
		src = json.loads(SRC_OVERRIDES_PATH.read_text(encoding="utf-8"))
		overrides = {**src, **overrides}

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

	if overrides:
		payload = json.dumps(overrides, ensure_ascii=False, indent="\t") + "\n"
		OVERRIDES_PATH.write_text(payload, encoding="utf-8")
		SRC_OVERRIDES_PATH.write_text(payload, encoding="utf-8")
		print(f"synced overrides → {OVERRIDES_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
	main()
