<!-- source: .cursor/product/yandex-webmaster.md -->
<!-- synced: 2026-09-23 -->

# Yandex Webmaster (оператор)

Live already serves:

- `https://www.repdraft.xyz/sitemap.xml` (HTTP 200, listed in `robots.txt`)
- `https://www.repdraft.xyz/favicon.ico` (+ PNG 16/32/48 from v0.18.7)

If Вебмастер still shows «Нет Sitemap» / «favicon не найден», that is usually **queue / recheck**, not missing files.

## Do in Webmaster (manual)

1. **Sitemap:** Индексирование → Файлы Sitemap → добавить  
   `https://www.repdraft.xyz/sitemap.xml`  
   Дождаться обработки (не «отклонён»).
2. **Favicon:** на карточке «Файл favicon не найден» нажать **Проверить**.  
   При необходимости: Индексирование → Переобход страниц → главная `/`.
3. **Регион:** Оптимизация → указать регион (например Москва / Россия). Не код.
4. **Яндекс Бизнес:** карточка организации. Не код. Для PWA без офиса можно отложить.

## Code side (already)

- `robots.txt` → `Sitemap: https://www.repdraft.xyz/sitemap.xml`
- Head: `shortcut icon` + `favicon.ico` + PNG sizes
- `vercel.json` cache headers for favicon / sitemap / robots

## Recheck after deploy

```bash
curl -sI https://www.repdraft.xyz/favicon.ico | head -5
curl -sI https://www.repdraft.xyz/favicon-32x32.png | head -5
curl -sI https://www.repdraft.xyz/sitemap.xml | head -5
curl -s https://www.repdraft.xyz/robots.txt
```
