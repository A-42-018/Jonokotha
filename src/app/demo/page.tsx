import Link from "next/link";
import DemoToggle from "@/components/DemoToggle";
import { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { demoOn } from "@/lib/demo-mode-server";
import { DEMO_FEATURES } from "@/lib/demo/features";
import { bi } from "@/lib/demo/util";
import { getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const T = {
  title: bi("ডেমো উদাহরণ", "Demo examples"),
  lead: bi("প্রতিটি সুবিধার জন্য নমুনা তথ্যসহ চেষ্টা করে দেখুন। সব উদাহরণ কোডে তৈরি; ডাটাবেস থেকে কিছু পড়া হয় না, ডাটাবেসে কিছু লেখাও হয় না।", "Try every feature with example data. Everything is made in code: nothing is read from the database and nothing is written to it."),
  start: bi("ডেমো চালু করুন", "Start the demo"), stop: bi("ডেমো বন্ধ করুন", "Stop the demo"),
  on: bi("ডেমো চালু আছে। নিচের লিংকগুলো এখন নমুনা তথ্য দেখাবে।", "Demo is on. The links below now show example data."),
  off: bi("ডেমো বন্ধ। চালু করলে নিচের লিংকগুলো নমুনা তথ্য দেখাবে।", "Demo is off. Start it so the links below show example data."),
  how: bi("কীভাবে কাজ করে", "How it works"),
  how1: bi("“ডেমো চালু করুন” চাপুন। এটি আপনার ব্রাউজারে একটি কুকি বসায়; অ্যাকাউন্ট লাগে না।", "Press “Start the demo”. It sets a cookie in your browser; no account is needed."),
  how2: bi("প্রকৃত পাতাগুলোই খোলে, কিন্তু উত্তর আসে কোড থেকে। ভোট, সমর্থন বা প্রশ্ন পাঠালে তা শুধু এই পাতায় থাকে, রিলোডে মুছে যায়।", "The real screens open, but answers come from code. Votes, support and questions only live on the page and vanish on reload."),
  how3: bi("উদাহরণের রেফারেন্স JKD- দিয়ে শুরু, তাই বাস্তব অভিযোগের (JK-…) সঙ্গে গুলিয়ে যায় না। ওপরের হলুদ ব্যানার সবসময় মনে করিয়ে দেয়।", "Example references start with JKD-, so they never look like real reports (JK-…). The yellow banner on top always reminds you."),
  tryTitle: bi("চেষ্টা করুন", "Try this"),
  photos: bi("নমুনা ছবি", "Sample photos"),
  note: bi("সব ছবি আঁকা নমুনা, বাস্তব ঘটনার ছবি নয়। প্রতিটিতে “নমুনা ছবি” লেখা আছে।", "All pictures are drawn samples, not photos of real events. Each is marked “Sample image”."),
};

export default async function Demo() {
  const lang = await getLang();
  const on = await demoOn();
  const t = (b: { bn: string; en: string }) => b[lang];
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="jk-h1">{t(T.title)}</h1>
        <p className="text-muted">{t(T.lead)}</p>
        <DemoToggle serverOn={on} labels={{ start: t(T.start), stop: t(T.stop), on: t(T.on), off: t(T.off) }} />
      </div>
      <Card tone="info" title={t(T.how)}>
        <ol className="list-decimal space-y-1 ps-5"><li>{t(T.how1)}</li><li>{t(T.how2)}</li><li>{t(T.how3)}</li></ol>
      </Card>
      <ul className="grid gap-4 md:grid-cols-2">
        {DEMO_FEATURES.map((f) => (
          <li key={f.id}>
            <Card as="article" id={f.id} className="h-full">
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.icon} alt="" width={72} height={72} loading="lazy" decoding="async" className="size-16 shrink-0 sm:size-[72px]" />
                <div className="min-w-0">
                  <h2 className="jk-h3 break-words">{t(f.title)}</h2>
                  <p className="text-muted">{t(f.lead)}</p>
                </div>
              </div>
              {f.photos && (
                <ul aria-label={t(T.photos)} className="mt-3 grid grid-cols-3 gap-2">
                  {f.photos.map((p) => (
                    <li key={p}>{/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/demo/${p}.svg`} alt="" loading="lazy" decoding="async" className="aspect-[16/10] w-full rounded-lg object-cover" /></li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-sm"><b>{t(T.tryTitle)}:</b> {t(f.tryIt)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {f.links.map((l, i) => <Link key={l.href} href={l.href} className={buttonClass({ variant: i === 0 ? "primary" : "secondary" })}>{t(l.label)}</Link>)}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">{t(T.note)}</p>
    </div>
  );
}
