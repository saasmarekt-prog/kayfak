# تشغيل Supabase محليًا لمشروع KAYFAK

## المتطلبات

- Docker Desktop أو Docker Engine يعمل.
- Supabase CLI مثبت ومسجل الدخول عند الربط بمشروع بعيد.
- Node.js وتبعيات المشروع.

## التشغيل المحلي

من جذر المشروع:

```bash
supabase start
supabase status
supabase db reset
```

`db reset` ينشئ قاعدة محلية جديدة، يطبق migrations من `supabase/migrations` بالترتيب، ثم يشغل `supabase/seed.sql`.

المنافذ الافتراضية:

- API: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- Inbucket للبريد المحلي: `http://127.0.0.1:54324`

## مستخدم محلي للتجربة

أنشئ مستخدمًا من Supabase Studio أو CLI، ثم شغّل `supabase db reset` مرة أخرى حتى ينشئ seed قصة التجربة لحساب لديه profile.

```bash
supabase status
supabase auth admin create-user --email admin@example.test --password 'change-this-local-password' --email-confirm
```

لا تستخدم بيانات الاختبار هذه في الإنتاج.

## ربط التطبيق المحلي

أنشئ ملف `.env` في جذر المشروع اعتمادًا على `.env.example`:

```env
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=ضع_anon_key_من_supabase_status
```

ثم شغّل:

```bash
npm install
npm run web
```

لـLiveKit Native استخدم development build، وليس Expo Go.

## ربط staging أو production

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase test db
supabase secrets set --env-file supabase/functions/.env
```

بعد ذلك انشر Edge Functions حسب [دليل التكاملات](./integrations-setup.md).

## قواعد أمان

- لا تضع `service_role` في `.env` الخاص بالتطبيق.
- لا ترفع `supabase/functions/.env` إلى Git.
- لا تشغّل `supabase db reset` على مشروع بعيد؛ الأمر محلي فقط.
- راجع migration في staging قبل تطبيقها على production.
- خذ backup قبل أي migration إنتاجية حساسة.
