import { desktopApi } from "./api";
import { Product } from "./types";
import { getLocalDateString } from "./utils";

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 AI USAGE LIMITS - Daily quota per user
// ═══════════════════════════════════════════════════════════════════════════════

const DAILY_AI_LIMIT = 20; // Maximum AI requests per day per user
const STORAGE_KEY = 'ai_usage_tracking';

interface AIUsageData {
  date: string; // YYYY-MM-DD
  count: number;
}

function getTodayKey(): string {
  return getLocalDateString();
}

function getUsageData(): AIUsageData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as AIUsageData;
      // Reset if it's a new day
      if (data.date !== getTodayKey()) {
        return { date: getTodayKey(), count: 0 };
      }
      return data;
    }
  } catch (e) {
    console.error('Error reading AI usage data:', e);
  }
  return { date: getTodayKey(), count: 0 };
}

function incrementUsage(): void {
  const data = getUsageData();
  data.count += 1;
  data.date = getTodayKey();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function isAILimitReached(): boolean {
  return getUsageData().count >= DAILY_AI_LIMIT;
}

/**
 * Executes an AI request using the secure backend.
 * Includes daily usage limit checking.
 */
async function executeAIRequest(
  complexity: 'BASIC' | 'COMPLEX',
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  // Check usage limit before making request
  if (isAILimitReached()) {
    return `⚠️ تجاوزت حد الاستخدام اليومي (${DAILY_AI_LIMIT} طلب/يوم).\n\n🔄 سيتم تجديد رصيدك غداً تلقائياً.\n💡 للحصول على استخدام غير محدود، تواصل مع الدعم لترقية خطتك.`;
  }

  try {
    // Append system instruction to prompt if provided
    let fullPrompt = prompt;
    if (systemInstruction) {
      fullPrompt = `${systemInstruction}\n\n---\nUser Request: ${prompt}`;
    }

    let result: string;
    if (complexity === 'COMPLEX') {
      result = await desktopApi.ai.generateComplex(fullPrompt);
    } else {
      result = await desktopApi.ai.generateBasic(fullPrompt);
    }

    // Only increment usage on successful requests
    incrementUsage();
    return result;
  } catch (error: unknown) {
    console.error(`AI Request Failed:`, error);
    const msg = error instanceof Error ? error.message : String(error);

    // Handle Server-Side Limit
    if (msg.includes("daily_limit_exceeded")) {
      return `⚠️ تجاوزت حد الاستخدام اليومي (${DAILY_AI_LIMIT} طلب/يوم).\n\n🔄 سيتم تجديد رصيدك غداً تلقائياً.\n💡 للحصول على استخدام غير محدود، تواصل مع الدعم لترقية خطتك.`;
    }

    // Handle Quota Exceeded (Error 429)
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || msg.includes("exceeded")) {
      return `⚡ تم استنفاد كوتا API الذكاء الاصطناعي!\n\n📊 حد الاستخدام المجاني من Google قد استُنفد.\n⏰ يرجى الانتظار بضع دقائق ثم المحاولة مجدداً.\n🔑 أو تواصل مع المطور لإضافة مفتاح API جديد.`;
    }

    // Handle Connection Errors
    if (msg.includes("connection_failed") || msg.includes("network") || msg.includes("timeout")) {
      return `🌐 فشل الاتصال بخدمة الذكاء الاصطناعي.\n\n📡 تأكد من اتصالك بالإنترنت.\n🔄 حاول مرة أخرى بعد قليل.`;
    }

    // Handle API Key errors
    if (msg.includes("API key") || msg.includes("invalid") || msg.includes("401") || msg.includes("403")) {
      return `🔑 خطأ في مفتاح API!\n\nيرجى التحقق من صلاحية مفتاح الذكاء الاصطناعي في الإعدادات.`;
    }

    return `❌ فشل في الحصول على رد الذكاء الاصطناعي.\n\nالخطأ: ${msg.substring(0, 100)}...`;
  }
}

// --- FEATURES ---

export const generateProductDescription = async (name: string, category: string): Promise<string> => {
  const prompt = `اكتب وصفاً تسويقياً جذاباً واحترافياً للمنتج التالي: "${name}" في فئة "${category}". الوصف يجب أن يكون باللغة العربية، قصيراً (جملتين كحد أقصى)، ويبرز القيمة.`;
  return await executeAIRequest('BASIC', prompt);
};

export const suggestProductEmoji = async (name: string, category?: string): Promise<string> => {
  const prompt = `اختر إيموجي واحد فقط يمثل هذا المنتج بشكل مناسب:
المنتج: "${name}"
${category ? `الفئة: "${category}"` : ''}

أمثلة:
- "عصير برتقال" -> 🍊
- "لبن" -> 🥛
- "خبز" -> 🍞

أجب فقط بإيموجي واحد بدون أي نص إضافي.`;

  const result = await executeAIRequest('BASIC', prompt);
  // Extract only emoji from response (filter out any text)
  const emojiMatch = result.match(/[\p{Emoji}]/gu);
  return emojiMatch ? emojiMatch[0] : '📦'; // Default to package emoji
};

export const improveText = async (text: string): Promise<string> => {
  const prompt = `قم بإعادة صياغة النص التالي ليكون أكثر احترافية، صحح الأخطاء اللغوية، واجعله موجزاً (باللغة العربية): "${text}"`;
  const result = await executeAIRequest('BASIC', prompt);
  return result.replace(/"/g, '');
};

export const analyzeInventoryRisk = async (lowStockItems: Product[]): Promise<string> => {
  if (lowStockItems.length === 0) return "✅ المخزون ممتاز - لا نواقص حرجة.";

  const itemsList = lowStockItems.slice(0, 5).map(p => `${p.name} (${p.stock})`).join('، ');
  const prompt = `النواقص: ${itemsList}

**المطلوب:** حلل المخزون وأعطني سطر واحد فقط (One line) يحتوي على أهم إجراء:
[إيموجي] [تنبيه عن أخطر منتج] -> [نصيحة سريعة]`;
  return await executeAIRequest('BASIC', prompt, "أنت مدير مخزون ذكي. إجابتك يجب أن تكون سطراً واحداً فقط.");
};

export const suggestProductPrice = async (name: string, cost: number): Promise<string> => {
  const prompt = `المنتج: "${name}"، التكلفة: ${cost}. اقترح سعر بيع تنافسي بالدينار العراقي (IQD) بناءً على هامش ربح معقول (20-30%). أعد فقط الرقم المقترح بدون نص.`;
  const res = await executeAIRequest('BASIC', prompt);
  return res.replace(/[^0-9]/g, '');
};

export const analyzeCustomerProfile = async (name: string, totalPurchases: number, debt: number): Promise<string> => {
  const prompt = `📋 تحليل عميل:
• الاسم: ${name}
• المشتريات: ${totalPurchases} د.ع
• الديون: ${debt} د.ع

**أجب بهذا التنسيق فقط:**
[⭐ VIP / 👤 عادي / ⚠️ مخاطرة] - سبب التصنيف بجملة واحدة
💡 توصية: [إجراء واحد محدد]`;
  return await executeAIRequest('BASIC', prompt);
};

export const categorizeExpense = async (title: string): Promise<string> => {
  const prompt = `عنوان المصروف: "${title}". صنف هذا المصروف إلى واحد فقط من المفاتيح التالية بالإنجليزية: 'rent', 'salary', 'bills', 'maintenance', 'other'. أعد الكلمة فقط.`;
  const res = await executeAIRequest('BASIC', prompt);
  const clean = res.trim().toLowerCase().replace(/['"]/g, '');
  return ['rent', 'salary', 'bills', 'maintenance', 'other'].includes(clean) ? clean : 'other';
};

export const writeRestockEmail = async (supplierName: string, storeName: string): Promise<string> => {
  const prompt = `اكتب مسودة بريد إلكتروني رسمي ومحترم باللغة العربية من مدير متجر "${storeName}" إلى المورد "${supplierName}" تطلب فيه قائمة الأسعار المحدثة وتوافر بضاعة جديدة.`;
  return await executeAIRequest('COMPLEX', prompt);
};

export const forecastSales = async (dailyRevenues: number[]): Promise<string> => {
  const prompt = `📊 الإيرادات اليومية (آخر أسبوع): [${dailyRevenues.join(', ')}] د.ع

**المطلوب - أجب بهذا التنسيق:**
📈 الاتجاه: [تصاعدي ↑ / تنازلي ↓ / مستقر →]
🎯 التوقع: [جملة واحدة للأسبوع القادم]
💡 إجراء: [نصيحة عملية واحدة]`;
  return await executeAIRequest('COMPLEX', prompt, "أنت محلل بيانات. أجب بإيجاز.");
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧠 SMART AI INSIGHTS - Advanced Business Analytics
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a comprehensive daily business summary
 */
export const generateDailySummary = async (
  todaySales: number,
  yesterdaySales: number,
  ordersCount: number,
  topProducts: string[],
  lowStockCount: number
): Promise<string> => {
  const change = todaySales > 0 && yesterdaySales > 0
    ? ((todaySales - yesterdaySales) / yesterdaySales * 100).toFixed(1)
    : '0';

  const prompt = `📊 ملخص يومي:
• المبيعات: ${todaySales} د.ع (${change}% من أمس)
• الطلبات: ${ordersCount}
• الأكثر مبيعاً: ${topProducts.slice(0, 3).join('، ') || '-'}
• نواقص: ${lowStockCount}

**أجب بـ 3 نقاط فقط:**
1. 📈 تقييم الأداء (جملة واحدة)
2. ⚡ نقطة قوة أو ضعف
3. 💡 إجراء واحد للغد`;

  return await executeAIRequest('BASIC', prompt);
};

/**
 * Generate quick AI insight for dashboard widget
 */
export const getQuickInsight = async (
  todayRevenue: number,
  ordersCount: number,
  lowStockItems: number
): Promise<string> => {
  const prompt = `📊 اليوم: ${todayRevenue} د.ع | ${ordersCount} طلب | ${lowStockItems} نقص

**أعطني رؤية واحدة في سطر واحد فقط:**
[إيموجي] [الرؤية] → [إجراء واحد]

مثال: 📈 المبيعات قوية → استغل الزخم بعرض جديد`;

  return await executeAIRequest('BASIC', prompt);
};
