export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});

  const {answers=[]}=req.body||{};

  const prompt=`تو مغز هوشکس هستی. وظیفه تو تشخیص مهم‌ترین مشکل رشد کسب‌وکار کاربر و ساختن قدم بعدی است. پاسخ را کوتاه و اجرایی بده. ساختار: مشکل اصلی، چرا مهم است، اولویت 01، کار امروز، معیار نتیجه. اطلاعات کاربر: ${JSON.stringify(answers)}`;

  if(!process.env.AVALAI_API_KEY){
    return res.json({
      result:"برای اتصال مغز هوشکس، کلید API هنوز تنظیم نشده است. نسخه تشخیص آماده است.",
      debug: prompt
    });
  }

  const response=await fetch("https://api.avalai.ir/v1/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.AVALAI_API_KEY}`},
    body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:prompt}],temperature:0.4})
  });

  const data=await response.json();
  res.json({result:data.choices?.[0]?.message?.content||"خطا در تحلیل"});
}
