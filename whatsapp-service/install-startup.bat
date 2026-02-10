@echo off
:: Bu script WhatsApp servisini Windows Baslangiç'a ekler.
:: Bilgisayar acildiginda otomatik baslar.
:: Bir kere calistirmaniz yeterli.

set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set TARGET=%~dp0start-whatsapp.bat
set SHORTCUT=%STARTUP%\FoxWhatsApp.lnk

echo.
echo ===================================================
echo   Fox Turizm - WhatsApp Servisi Kurulumu
echo ===================================================
echo.
echo Kisayol olusturuluyor...

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%SHORTCUT%'); $sc.TargetPath = '%TARGET%'; $sc.WorkingDirectory = '%~dp0'; $sc.WindowStyle = 7; $sc.Description = 'Fox Turizm WhatsApp Servisi'; $sc.Save()"

if exist "%SHORTCUT%" (
    echo.
    echo [OK] Basarili! WhatsApp servisi Windows Baslangic'a eklendi.
    echo     Bilgisayar her acildiginda otomatik calisacak.
    echo.
    echo Kisayol: %SHORTCUT%
    echo.
) else (
    echo.
    echo [HATA] Kisayol olusturulamadi!
    echo.
)

echo Kaldirmak icin: %SHORTCUT% dosyasini silin.
echo.
pause
