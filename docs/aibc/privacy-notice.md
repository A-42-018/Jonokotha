# Privacy notice (content for the frontend)

Draft for counsel and native-Bangla review. **Not yet reviewed by counsel.** Bangla first; English follows. Placeholders in [brackets] must be filled before publishing.

## সংক্ষেপে (সহজ বাংলা)

- আপনি যা লেখেন, তা শুধু অভিযোগ বা প্রশ্ন সামলাতে ব্যবহার হয়। আমরা আপনার তথ্য বিক্রি করি না, বিজ্ঞাপনে দিই না।
- আপনার রিপোর্টের শিরোনাম, বিবরণ ও আনুমানিক এলাকা জনসমক্ষে আসতে পারে। ফোন নম্বর, ইমেইল, আইডি নম্বর আমরা সরানোর চেষ্টা করি, কিন্তু সবসময় পারি না। তাই এসব লিখবেন না।
- আপনার সঠিক অবস্থান ও ছবি শুধু আপনি ও দায়িত্বপ্রাপ্ত অফিস দেখে। ছবি জনসমক্ষে আসার আগে যাচাই হয়।
- এআই শুধু খসড়া করে। জনসমক্ষে যাওয়া উত্তর সবসময় একজন মানুষ অনুমোদন করেন।
- আপনি যেকোনো সময় আপনার তথ্য ডাউনলোড করতে, নাম বা ভাষা ঠিক করতে, সম্মতি তুলে নিতে এবং অ্যাকাউন্ট মুছে ফেলার অনুরোধ করতে পারেন। মোছার অনুরোধ ১৪ দিন পর কার্যকর হয়; তার আগে বাতিল করা যায়।
- এই সেবা জরুরি সেবা নয়। প্রাণের ঝুঁকি হলে ৯৯৯-এ ফোন করুন।

## বিস্তারিত

**কে দায়ী।** [সংস্থার নাম ও ঠিকানা]। যোগাযোগ: [ইমেইল]। [তথ্য সুরক্ষা দায়িত্বপ্রাপ্ত ব্যক্তি, যদি থাকে]।

**কোন তথ্য নিই ও কেন।** ইমেইল ও নাম (সাইন ইন ও বিজ্ঞপ্তি); রিপোর্ট, আইডিয়া ও প্রশ্নের লেখা, বিভাগ, এলাকা ও সময় (বিষয়টি সামলানো); সঠিক অবস্থান (সঠিক নির্বাচনী এলাকা ঠিক করা); ছবি (প্রমাণ); আপনি যা অনুসরণ করেন ও বিজ্ঞপ্তির পছন্দ (ব্যক্তিগত ফিড ও বিজ্ঞপ্তি); আপনার সম্মতির রেকর্ড; নিরাপত্তার জন্য কে কী করেছে তার লগ।

**কারা দেখে।** জনসমক্ষে: প্রকাশিত রিপোর্টের শিরোনাম, বিবরণ, আনুমানিক এলাকা ও অবস্থা। সীমিত: আপনার এলাকার যাচাইকৃত অফিস; মডারেটর ও অ্যাডমিন (কাজের প্রয়োজনে, লগসহ)। আমাদের সেবাদাতা: ডাটাবেস ও হোস্টিং [Supabase, Vercel], এআই [প্রদানকারী ও অঞ্চল], ইমেইল [প্রদানকারী]। এআই-এর কাছে পাঠানোর আগে ফোন, ইমেইল ও আইডি নম্বর সরানো হয়।

**কতদিন রাখি।** [প্রতিটি তথ্যের মেয়াদ: প্রস্তাবিত তালিকা docs/aibc/pia.md-তে]। মুছে ফেলার অনুরোধে আপনাকে চেনায় এমন তথ্য মুছি বা অস্পষ্ট করি; জনসমক্ষে প্রকাশিত নাগরিক নথি ও নিরীক্ষা লগ থেকে যায়, তাতে আপনার নাম থাকে না।

**আপনার অধিকার।** ডাউনলোড (অ্যাপে "আমার তথ্য"), ঠিক করা (প্রোফাইল), সম্মতি তুলে নেওয়া, মোছার অনুরোধ। সমস্যা হলে [যোগাযোগ] এ লিখুন।

**শিশু।** [নীতি ঠিক করতে হবে]।

**পরিবর্তন।** নীতি বদলালে নতুন সংস্করণ নম্বরসহ জানানো হবে এবং সম্মতি আবার চাওয়া হতে পারে।

## English

**In short.** What you write is used only to handle your report, idea or question. We do not sell data or show ads. A report's title, description and approximate area can become public; we try to remove phone numbers, emails and ID numbers but cannot always, so do not write them. Your exact location and photos are seen only by you and the responsible office; photos are checked before they can become public. AI only drafts; anything public is approved by a person. You can download your data, correct your name or language, withdraw consent and request deletion at any time (deletion takes effect after 14 days and can be cancelled before). This is not an emergency service: if life is at risk call 999.

**Who is responsible.** [Organisation, address, contact, data protection contact if any].

**What we collect and why, who sees it, how long, your rights, children, changes:** as in the Bangla text above; the full tables are in `docs/aibc/pia.md`. Processors: [Supabase, Vercel, AI provider and region, email provider].

## For the frontend

Show the Bangla summary first, then "বিস্তারিত". Record acceptance with `POST /api/v1/me/consents` (`consent_type: "privacy_notice"`, current `policy_version`); withdrawal is the same call with `granted: false`. "আমার তথ্য" calls `GET /api/v1/me/export`; "অ্যাকাউন্ট মুছুন" calls `POST /api/v1/me/deletion-request`, and shows the date from `GET /api/v1/me/profile` (`deletion_requested_at`) with a cancel button (`DELETE` on the same path).
