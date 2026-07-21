# Safe Attachment Trash

## فارسی

افزونه‌ای برای Obsidian که فایل‌های بلااستفاده را پیدا می‌کند، پس از تأیید کاربر به یک سطل امن منتقل می‌کند و مسیر اصلی آن‌ها را برای بازگردانی دقیق نگه می‌دارد.

### قابلیت‌ها

- اسکن خودکار فایل‌های بلااستفاده هنگام بازکردن پنل افزونه
- دکمه «تازه‌سازی» برای اجرای دوباره اسکن
- نمایش فهرست فایل‌های پیدا‌شده پیش از انتقال به سطل امن
- انتخاب همه با یک Checkbox
- رابط فارسی و انگلیسی با حالت خودکار بر اساس زبان Obsidian
- بازکردن عکس، PDF، صوت، ویدئو و فایل‌های متنی در یک تب مستقل در بخش اصلی Obsidian
- نگهداری مسیر اصلی هر فایل
- بازگردانی یک فایل یا فایل‌های انتخاب‌شده به محل اصلی
- بازگردانی همه فایل‌ها با «انتخاب همه» و سپس «بازگردانی انتخاب‌شده‌ها»
- حذف کامل یک فایل یا فایل‌های انتخاب‌شده
- خالی‌کردن کامل سطل با «انتخاب همه» و سپس «حذف انتخاب‌شده‌ها»
- ساخت دوباره پوشه‌های مسیر اصلی هنگام بازگردانی
- مدیریت فایل هم‌نام هنگام بازگردانی: تغییر نام، ردکردن یا جایگزینی
- انتقال دستی فایل از منوی راست‌کلیک
- ذخیره فایل‌ها و متادیتا در `.safe-attachment-trash`
- بدون اینترنت و بدون Telemetry

### نصب دستی

1. پوشه `safe-attachment-trash` را داخل مسیر زیر کپی کن:

   `YourVault/.obsidian/plugins/`

2. Obsidian را Reload کن.
3. به `Settings → Community plugins` برو.
4. افزونه `Safe Attachment Trash` را فعال کن.

### استفاده

- با آیکن سطل زباله در Ribbon، پنل افزونه را باز کن.
- اسکن به‌صورت خودکار اجرا می‌شود.
- فایل‌های موردنظر را انتخاب و به Safe Trash منتقل کن.
- روی هر فایل داخل پنل کلیک کن تا در یک تب اصلی Obsidian باز شود.
- برای بازگردانی یا حذف دسته‌جمعی، Checkbox «انتخاب همه» را فعال کن و دکمه عملیات انتخاب‌شده‌ها را بزن.

### نکته مهم

این افزونه از Trash داخلی Obsidian (`.trash`) جداست. برای اینکه مسیر اصلی فایل قابل بازیابی باشد، فایل باید از طریق این افزونه به Safe Trash منتقل شود.

---

## English

An Obsidian plugin that finds unused attachments, moves approved files to a managed safe trash, and remembers every original path for precise restoration.

### Features

- Automatically scans for unused files when the plugin panel opens
- Refresh button to scan again
- Review unused files before moving them
- Select-all checkbox
- Persian and English interface, with automatic language detection
- Opens images, PDFs, audio, video, and text files in a full Obsidian workspace tab
- Remembers the original path of every file
- Restores one file or selected files to their original locations
- Restores everything through Select all + Restore selected
- Permanently deletes one file or selected files
- Empties the entire safe trash through Select all + Delete selected
- Recreates missing original folders during restoration
- Handles restore conflicts by renaming, skipping, or overwriting
- Supports manual move from the file context menu
- Stores files and metadata under `.safe-attachment-trash`
- No internet access and no telemetry

### Manual installation

1. Copy the `safe-attachment-trash` folder into:

   `YourVault/.obsidian/plugins/`

2. Reload Obsidian.
3. Open `Settings → Community plugins`.
4. Enable `Safe Attachment Trash`.

### Important

This plugin uses its own managed trash instead of Obsidian's built-in `.trash`. Files must be moved through this plugin for reliable original-path restoration.
