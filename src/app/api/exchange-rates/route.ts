import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let cachedRates: { rates: Record<string, number>; timestamp: number } | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 dakika

export async function GET() {
  try {
    // Cache kontrolü
    if (cachedRates && Date.now() - cachedRates.timestamp < CACHE_DURATION) {
      return NextResponse.json({ 
        rates: cachedRates.rates, 
        cached: true, 
        lastUpdate: new Date(cachedRates.timestamp).toLocaleString("tr-TR")
      });
    }

    // TCMB XML API'sinden kurları çek
    const response = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) throw new Error('TCMB API error');

    const xmlText = await response.text();
    
    // XML parse et - basit regex kullanarak (newline'ları da yakalayacak şekilde)
    const usdMatch = xmlText.match(/<Currency[^>]*Kod="USD"[^>]*>[\s\S]*?<ForexSelling>([\d.,]+)<\/ForexSelling>[\s\S]*?<\/Currency>/);
    const eurMatch = xmlText.match(/<Currency[^>]*Kod="EUR"[^>]*>[\s\S]*?<ForexSelling>([\d.,]+)<\/ForexSelling>[\s\S]*?<\/Currency>/);
    
    if (!usdMatch || !eurMatch) throw new Error('Currency data not found');

    const rates = {
      USD: parseFloat(usdMatch[1].replace(',', '.')),
      EUR: parseFloat(eurMatch[1].replace(',', '.')),
      TL: 1 // TL to TL
    };

    // Cache güncelle
    cachedRates = { rates, timestamp: Date.now() };

    return NextResponse.json({ 
      rates, 
      cached: false, 
      lastUpdate: new Date().toLocaleString("tr-TR")
    });

  } catch (error) {
    console.error('Exchange rate error:', error);
    
    // Fallback kurlar (TCMB erişilemezse)
    const fallbackRates = { USD: 49.50, EUR: 53.00, TL: 1 };
    
    return NextResponse.json({ 
      rates: fallbackRates, 
      error: 'TCMB API unavailable, using fallback rates',
      cached: false,
      lastUpdate: new Date().toLocaleString("tr-TR")
    });
  }
}