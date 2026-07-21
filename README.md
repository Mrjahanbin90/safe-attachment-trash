# Safe Attachment Trash

## فارسی

افزونه‌ای برای Obsidian که فایل‌های بلااستفاده را پیدا می‌کند، فایل‌های انتخاب‌شده را با API رسمی حذف Obsidian پردازش می‌کند، نسخه قابل‌بازیابی را داخل `.trash` خود Vault نگه می‌دارد و مسیر اصلی را برای بازگردانی دقیق ذخیره می‌کند.

### قابلیت‌ها

- اسکن خودکار فایل‌های بلااستفاده هنگام بازکردن پنل افزونه
- بازبینی و انتخاب فایل‌ها پیش از انتقال
- استفاده از Trash داخلی Vault در مسیر `.trash`؛ بدون پوشه‌ی مستقل `.safe-attachment-trash`
- ذخیره‌ی مسیر اصلی و اطلاعات بازیابی در `data.json` افزونه با `Plugin.loadData()` و `Plugin.saveData()`
- نمایش همه فایل‌های قابل‌دسترسی داخل `.trash`، حتی فایل‌هایی که خارج از افزونه وارد Trash شده‌اند
- ثبت مسیر حذف‌های دستی Obsidian در زمانی که افزونه فعال است و فایل در Trash محلی قرار می‌گیرد
- تشخیص احتمالی مسیر اصلی فایل‌های قدیمی که ساختار پوشه‌شان داخل `.trash` حفظ شده است
- انتقال فایل‌های با مسیر نامشخص به پوشه قابل‌تنظیم `Recovered from Trash`
- بازکردن عکس، PDF، صوت، ویدئو و فایل‌های متنی در تب اصلی Obsidian
- بازگردانی تکی یا گروهی به مسیر اصلی
- حذف کامل تکی یا گروهی با تأیید صریح
- مدیریت تداخل هنگام بازگردانی: تغییر نام، ردکردن یا جایگزینی
- مهاجرت امن فایل‌های نسخه‌های قبلی از `.safe-attachment-trash` به `.trash`
- رابط فارسی و انگلیسی
- تنظیمات قابل جست‌وجو با Declarative Settings API در Obsidian 1.13+
- بدون اینترنت، Telemetry و حساب کاربری

### رفتار Trash و تنظیم کاربر

افزونه برای حذف فایل اصلی از `FileManager.trashFile()` استفاده می‌کند؛ بنابراین انتخاب کاربر در بخش **Deleted files** رعایت می‌شود.

برای اینکه قابلیت پیش‌نمایش و بازیابی همیشه باقی بماند:

- اگر Obsidian فایل را داخل `.trash` محلی قرار دهد، همان فایل مدیریت می‌شود.
- اگر تنظیم کاربر فایل را به Trash سیستم‌عامل بفرستد یا حذف دائمی کند، افزونه یک نسخه‌ی بازیابی داخل `.trash` محلی Vault می‌سازد.

در حالت Trash سیستم‌عامل ممکن است یک نسخه هم در Recycle Bin یا Trash سیستم باقی بماند. افزونه فقط نسخه‌ی داخل `.trash` Vault را مدیریت می‌کند.

### مسیرهای نامشخص

برای فایل‌هایی که افزونه انتقال داده یا حذفشان را هنگام فعال‌بودن مشاهده کرده است، مسیر اصلی ذخیره می‌شود. فایل‌هایی که از قبل داخل `.trash` بوده‌اند ممکن است متادیتای مسیر اصلی نداشته باشند. در این حالت:

- اگر ساختار مسیر قابل استنباط باشد، با برچسب «مسیر احتمالی» نمایش داده می‌شود.
- در غیر این صورت، فایل هنگام بازیابی به پوشه‌ی `Recovered from Trash` یا پوشه‌ای که در تنظیمات تعیین شده منتقل می‌شود.

### نصب دستی

1. فایل‌های `main.js`، `manifest.json` و `styles.css` را داخل این مسیر قرار بده:

   `YourVault/.obsidian/plugins/safe-attachment-trash/`

2. Obsidian را Reload کن.
3. به `Settings → Community plugins` برو.
4. افزونه `Safe Attachment Trash` را فعال کن.

### حریم خصوصی و دسترسی‌ها

- افزونه برای پیدا کردن فایل‌های بلااستفاده مسیر فایل‌های Vault و لینک‌های یادداشت‌ها را بررسی می‌کند.
- برای خواندن و مدیریت `.trash` از Adapter API استفاده می‌شود، چون پوشه‌های مخفی از طریق Vault API قابل مشاهده نیستند.
- هیچ داده‌ای از Vault خارج نمی‌شود و هیچ درخواست شبکه‌ای انجام نمی‌شود.

---

## English

An Obsidian plugin that finds unused attachments, processes approved deletions through Obsidian's official file-management API, keeps the recoverable copy in the vault's built-in `.trash`, and remembers original paths for precise restoration.

### Features

- Automatically scans for unused attachments when the panel opens
- Lets users review and select files before moving them
- Uses the vault's built-in `.trash`; no separate `.safe-attachment-trash` storage
- Persists settings and restore metadata through `Plugin.loadData()` and `Plugin.saveData()`
- Lists accessible files already present in `.trash`, including files not moved by the plugin
- Records manual Obsidian deletions while the plugin is active when they land in local trash
- Infers an original path for older trash files when their folder structure is preserved
- Restores unknown-path files to the configurable `Recovered from Trash` folder
- Opens images, PDFs, audio, video, and text files in a full workspace tab
- Restores one file or selected files
- Permanently deletes one file or selected files after explicit confirmation
- Handles restore conflicts by renaming, skipping, or overwriting
- Safely migrates previous `.safe-attachment-trash` contents into `.trash`
- Persian and English interface
- Searchable settings using Obsidian 1.13+ declarative settings
- No network requests, telemetry, or accounts

### Trash behavior and user preference

The plugin uses `FileManager.trashFile()` for the original file, so the user's **Deleted files** preference is respected.

To keep in-app preview and restoration available:

- When Obsidian moves the file to local `.trash`, the plugin manages that file directly.
- When the user's preference sends the original to the operating-system trash or deletes it permanently, the plugin creates a recoverable copy inside the vault's local `.trash`.

With system trash enabled, another copy may remain in the operating system's Recycle Bin or Trash. The plugin manages only the copy inside the vault's `.trash`.

### Unknown original paths

Files moved by the plugin, or observed while the plugin is active, retain their original path. Pre-existing trash files may not contain enough metadata to reconstruct it. In that case:

- A preserved folder structure is shown as an inferred path.
- Otherwise, restoration uses the configurable `Recovered from Trash` folder.

### Manual installation

Copy `main.js`, `manifest.json`, and `styles.css` into:

`YourVault/.obsidian/plugins/safe-attachment-trash/`

Reload Obsidian and enable **Safe Attachment Trash** under Community plugins.

### Privacy and access

- The plugin enumerates vault file paths and note links to detect unused attachments.
- It uses the Adapter API only where required to access the hidden `.trash` folder.
- No vault data leaves the device and no network requests are made.
