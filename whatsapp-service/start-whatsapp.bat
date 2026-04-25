@echo off
:: Visora - WhatsApp Servisi Otomatik Baslatici
:: Bu dosya Windows Baslangiç klasörüne kısayol olarak eklenir.
:: Arka planda calısır, terminal penceresi gizlenir.

cd /d "%~dp0"
start /min "" node index.js
