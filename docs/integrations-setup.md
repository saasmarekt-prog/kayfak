# إعداد التكاملات

بعد إنشاء مشروع Supabase وربطه، طبّق migrations بالترتيب باستخدام `supabase db push`. شغّل اختبارات قاعدة البيانات عبر `supabase test db` في بيئة staging قبل الإنتاج.

أنشئ الأسرار في بيئة Edge Functions، وليس داخل التطبيق أو GitHub. محليًا استخدم `supabase/functions/.env` انطلاقًا من `.env.example`، وفي المشروع البعيد استخدم `supabase secrets set --env-file supabase/functions/.env` بعد مراجعة القيم.

لـLiveKit، اضبط `LIVEKIT_URL` و`LIVEKIT_API_KEY` و`LIVEKIT_API_SECRET`. انشر `livekit-token` و`livekit-webhook`، ثم سجّل webhook مزود LiveKit على عنوان `.../functions/v1/livekit-webhook`. يجب أن يرسل المزود جسم الطلب الخام وترويسة Authorization حتى يتحقق `WebhookReceiver` من التوقيع.

للهدايا، انشر `send-gift`. لا يمنح التطبيق العملات ولا يمرر `service_role`; الوظيفة تتحقق من JWT المستخدم وتستدعي تسوية الخادم. لا تعتبر قيمة الهدية المعروضة في الواجهة مصدر ثقة.

لـStripe، اضبط `STRIPE_SECRET_KEY` و`STRIPE_WEBHOOK_SECRET` و`BILLING_PRODUCTS_JSON`. القائمة تربط product IDs بعدد العملات على الخادم فقط. انشر `billing-webhook` وسجّل أحداث `checkout.session.completed` من Stripe. الوظيفة تتحقق من التوقيع وتستخدم idempotency قبل منح العملات، وتربط اشتراكات Stripe بجدول `subscriptions`.

لا تزال Apple App Store وGoogle Play تحتاجان adapter منفصلًا للتحقق من إيصالات الشراء وتجديد الاشتراك. لا تضع مفاتيح المتاجر في التطبيق ولا تمنح العملات بناءً على إشعار صادر من الجهاز وحده.

## أوامر النشر النموذجية

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy livekit-token
supabase functions deploy livekit-webhook
supabase functions deploy send-gift
supabase functions deploy billing-webhook
supabase test db
```

التطبيق يستدعي `livekit-token` من شاشة الغرفة بعد نجاح العضوية. إصدار الرمز أصبح مربوطًا، لكن طبقة الصوت الأصلية `livekit-client` أو `@livekit/react-native` تحتاج إضافتها إلى build Expo development client؛ إصدار الرمز وحده لا ينشئ اتصالًا صوتيًا.
