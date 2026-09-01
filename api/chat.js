export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});

  const {answers=[]}=req.body||{};

  const systemPrompt=`تو مغز هوشکس هستی.
ماموریت: تشخیص مهم‌ترین مانع رشد کسب‌وکار و مشخص کردن فقط یک قدم بعدی.

مخاطب: صاحب کسب‌وکار کوچک ایرانی که بیشتر از اینستاگرام یا سایت مشتری می‌گیرد.

قوانین:
- جواب کلی و آموزشی طولانی نده.
- اولویت فقط یک مورد باشد.
- کار امروز باید قابل انجام در کمتر از یک روز باشد.
- اگر اطلاعات کم است فقط سوال ضروری بپرس.

خروجی نهایی:
## مشکل اصلی
## چرا این اتفاق افتاده
## اولویت 01
## کار امروز
## زمان اجرا
## معیار نتیجه
## فعلا انجام نده

اطلاعات کاربر:
${JSON.stringify(answers)}`;

  if(!process.env.AVALAI_API_KEY){
    return res.json({result:"مغز هوشکس آماده است؛ کلید API هنوز متصل نشده."});
  }

  try{
    const response=await fetch("https://api.avalai.ir/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.AVALAI_API_KEY}`},
      body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:systemPrompt}],temperature:0.3})
    });

    const data=await response.json();
    res.json({result:data.choices?.[0]?.message?.content||"تحلیل انجام نشد"});
  }catch(e){
    res.status(500).json({error:"ارتباط با مغز هوشکس برقرار نشد"});
  }
}
