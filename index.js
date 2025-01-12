///////////////////////////////////////////
// index.js
///////////////////////////////////////////

// تحميل متغيرات البيئة من ملف .env
require('dotenv').config();

const puppeteer = require('puppeteer');
const express = require('express');
const mongoose = require('mongoose');
const app = express();

// الحصول على المنفذ من متغيرات البيئة أو استخدام 4000 كافتراضي
const PORT = process.env.PORT || 4000;

// إعداد اتصال MongoDB باستخدام URI من متغيرات البيئة
const mongoURI = process.env.MONGO_URI;

// التحقق من وجود URI قبل محاولة الاتصال
if (!mongoURI) {
  console.error('❌ متغير MONGO_URI غير معرف. تأكد من إعداد ملف .env بشكل صحيح.');
  process.exit(1); // إيقاف التطبيق إذا كان URI غير معرف
}

// إعداد اتصال Mongoose
mongoose
  .connect(mongoURI)
  .then(() => console.log('✅ تم الاتصال بقاعدة بيانات MongoDB بنجاح'))
  .catch((err) => {
    console.error('❌ فشل الاتصال بقاعدة بيانات MongoDB:', err.message);
    process.exit(1); // إيقاف التطبيق إذا فشل الاتصال
  });

// تعريف مخطط (Schema) للبيانات
const DataSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    request: {
      method: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    fetchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

const DataModel = mongoose.model('Data', DataSchema);

/** هذا هو الكائن الذي يحتوي على الروابط التي سنجرب الوصول إليها */
const snippet = {
  info: {
    _postman_id: '1712d4d3-7f24-419b-ad22-ee3ca075615c',
    name: 'sponsors mrt7al',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    _exporter_id: '740699',
  },
  item: [
    {
      name: 'cities',
      protocolProfileBehavior: {
        disableBodyPruning: true,
      },
      request: {
        auth: {
          type: 'bearer',
          bearer: [
            {
              key: 'token',
              value: '{{websiteToken}}',
              type: 'string',
            },
          ],
        },
        method: 'GET',
        header: [],
        body: {
          mode: 'formdata',
          formdata: [
            {
              key: 'from_city',
              value: '1',
              type: 'text',
              disabled: true,
            },
            {
              key: 'to_city',
              value: '2',
              type: 'text',
              disabled: true,
            },
            // بقية الحقول معطّلة (disabled)
          ],
        },
        url: {
          raw: 'https://administrator.mrt7al.com/rest/sponsors/cities.json?page=1',
          protocol: 'https',
          host: ['administrator', 'mrt7al', 'com'],
          path: ['rest', 'sponsors', 'cities.json'],
          query: [
            {
              key: 'page',
              value: '1',
            },
          ],
        },
      },
      response: [],
    },
    {
      name: 'home & search',
      request: {
        auth: {
          type: 'bearer',
          bearer: [
            {
              key: 'token',
              value: '{{websiteToken}}',
              type: 'string',
            },
          ],
        },
        method: 'POST',
        header: [],
        body: {
          mode: 'formdata',
          formdata: [
            {
              key: 'from_city',
              value: '23',
              type: 'text',
              disabled: true,
            },
            {
              key: 'to_city',
              value: '29',
              type: 'text',
              disabled: true,
            },
            {
              key: 'tripDate',
              value: '2025-01-06',
              type: 'text',
              disabled: true,
            },
            {
              key: 'city_id',
              value: '2',
              type: 'text',
              disabled: true,
            },
            {
              key: 'bus_type',
              value: 'Vip',
              type: 'text',
              disabled: true,
            },
            {
              key: 'is_direct',
              value: 'on',
              type: 'text',
              disabled: true,
            },
            {
              key: 'from_price',
              value: '0',
              type: 'text',
              disabled: true,
            },
            {
              key: 'to_price',
              value: '59',
              type: 'text',
              disabled: true,
            },
          ],
        },
        url: {
          raw: 'https://administrator.mrt7al.com/rest/sponsors/home.json?page=1',
          protocol: 'https',
          host: ['administrator', 'mrt7al', 'com'],
          path: ['rest', 'sponsors', 'home.json'],
          query: [
            {
              key: 'page',
              value: '1',
            },
          ],
        },
      },
      response: [],
    },
  ],
};

// سنحتفظ مؤقتًا بالبيانات في الذاكرة أيضًا
let cachedData = null;

/**
 * دالة لاستخراج البيانات بالاعتماد على snippet:
 * - تفتح متصفح puppeteer
 * - تتنقل بين الروابط (GET أو POST) حسب التعريف
 * - تحفظ النتائج في قاعدة البيانات وفي متغير cachedData
 */
const fetchData = async () => {
  try {
    console.log('⏳ بدء عملية جلب البيانات من الروابط المحددة ...');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // لتخزين النتائج
    const allResults = [];

    // تفعيل اعتراض الطلبات للتعامل مع الـPOST
    await page.setRequestInterception(true);

    // الحدث الذي سيُستدعى عند كل طلب
    page.on('request', (req) => {
      const currentItem = getCurrentItem(req.url());
      if (currentItem && currentItem.request.method === 'POST') {
        const formDataString = buildFormDataString(currentItem.request.body);

        // ضبط الطلب ليكون POST مع البيانات المناسبة
        req.continue({
          method: 'POST',
          postData: formDataString,
          headers: {
            ...req.headers(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
      } else {
        req.continue();
      }
    });

    // تفريغ المحتوى القديم من قاعدة البيانات
    // (حسب رغبتك؛ إن كنت تريد فقط آخر نسخة دوماً)
    await DataModel.deleteMany({});

    for (const item of snippet.item) {
      const url = item.request.url.raw;

      // نتوجّه إلى الرابط
      await page.goto(url, { waitUntil: 'networkidle2' });

      // بعد التحميل، نحاول جلب النص من الـ <body>
      const pageContent = await page.evaluate(() => {
        return document.querySelector('body')?.innerText || '';
      });

      let parsedData = {};
      try {
        parsedData = JSON.parse(pageContent);
      } catch {
        // لو لم تكن البيانات JSON نظيفة، نخزنها كنص فقط
        parsedData = { rawText: pageContent };
      }

      // نخزن النتيجة مصنفة باسم الطلب
      allResults.push({
        name: item.name,
        request: {
          method: item.request.method,
          url: item.request.url.raw,
        },
        data: parsedData,
      });

      // حفظ نفس النتيجة في قاعدة البيانات
      const dataEntry = new DataModel({
        name: item.name,
        request: {
          method: item.request.method,
          url: item.request.url.raw,
        },
        data: parsedData,
      });
      await dataEntry.save();
    }

    await browser.close();

    // تخزين نسخة في الذاكرة المؤقتة بالشكل الذي يحتاجه Flutter
    cachedData = {
      info: snippet.info,
      results: allResults,
    };

    console.log('✅ تم تحديث البيانات وتخزينها بنجاح.');
  } catch (error) {
    console.error('❌ حدث خطأ أثناء استخراج أو تخزين البيانات:', error.message);
  }
};

/**
 * تبحث عن العنصر في snippet.item الذي يطابق الرابط الحالي
 */
function getCurrentItem(url) {
  return snippet.item.find((item) => {
    const host = item.request.url.host.join('.');
    const path = item.request.url.path.join('/');
    return url.includes(host) && url.includes(path);
  });
}

/**
 * تحويل الـ formdata من الصيغة الموجودة في snippet
 * إلى key=value&key=value لاستخدامها كـ postData
 */
function buildFormDataString(body) {
  if (!body || body.mode !== 'formdata' || !body.formdata) {
    return '';
  }
  const fields = body.formdata
    .filter((field) => !field.disabled)
    .map((field) => {
      const key = encodeURIComponent(field.key);
      const value = encodeURIComponent(field.value);
      return `${key}=${value}`;
    });
  return fields.join('&');
}

/**
 * واجهة برمجية تعيد البيانات بالصيغة التي يتوقعها تطبيق Flutter:
 *  {
 *    "info": { ...snippet.info... },
 *    "results": [
 *      { name, request, data },
 *      { name, request, data },
 *      ...
 *    ]
 *  }
 */
app.get('/api/data', async (req, res) => {
  // إن كانت البيانات مخزنة في الذاكرة، نعيدها مباشرة
  if (cachedData) {
    return res.json(cachedData);
  }

  // في حال عدم وجود cachedData في الذاكرة
  // نستعيد كل المستندات من القاعدة ونرتبها
  try {
    const docs = await DataModel.find({}).sort({ fetchedAt: 1 }).lean();
    if (!docs.length) {
      return res.status(503).send('البيانات غير متاحة في الوقت الحالي.');
    }

    // بناء results من الوثائق الموجودة في القاعدة
    const resultsArr = docs.map((doc) => ({
      name: doc.name,
      request: doc.request,
      data: doc.data,
    }));

    const finalData = {
      info: snippet.info,
      results: resultsArr,
    };

    // تخزينها في الذاكرة لطلبات قادمة إن أردنا
    cachedData = finalData;

    res.json(finalData);
  } catch (err) {
    console.error('❌ خطأ أثناء جلب البيانات من قاعدة البيانات:', err.message);
    res.status(500).send('حدث خطأ أثناء جلب البيانات.');
  }
});

// بدء الخادم وتشغيل عملية استخراج البيانات عند التشغيل
app.listen(PORT, () => {
  console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
  // استخراج البيانات أول مرة عند بدء السيرفر
  fetchData();

  // تحديث البيانات كل ساعة (3600000 مللي ثانية)
  setInterval(fetchData, 3600000);
});