"use client";

import { Box, Container, Typography, Paper } from "@mui/material";
import { motion } from "framer-motion";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import { useLanguage } from "@/contexts/LanguageContext";
import PublicThemeProvider from "@/components/PublicThemeProvider";
import { Hanken_Grotesk, Manrope } from "next/font/google";

const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "700", "800"] });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export default function TermsPage() {
  const { lang, t } = useLanguage();

  const isBn = lang === "bn";

  const title = isBn ? "শর্তাবলী ও নীতিমালা" : "Terms and Conditions";
  const lastUpdated = isBn ? "সর্বশেষ আপডেট: ১৬ আগস্ট ২০২৬" : "Last Updated: August 16, 2026";

  const contentEn = [
    {
      title: "1. Acceptance of Terms",
      text: "By accessing and using StockWhisk's Cloud POS platform, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use our services."
    },
    {
      title: "2. Account Registration",
      text: "Users must provide accurate, current, and complete information during the registration process. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account."
    },
    {
      title: "3. Subscription and Billing",
      text: "StockWhisk is a subscription-based service. By subscribing to a paid plan, you authorize us to charge your selected payment method. Subscriptions renew automatically unless canceled before the next billing cycle. We reserve the right to modify our pricing with prior notice."
    },
    {
      title: "4. Data Privacy and Security",
      text: "Your data privacy is our priority. We employ industry-standard security measures to protect your sales, inventory, and customer data. We do not sell your data to third parties. For more details, please refer to our Privacy Policy."
    },
    {
      title: "5. Service Availability",
      text: "While we strive for 99.9% uptime, StockWhisk does not guarantee uninterrupted service. We may occasionally perform maintenance, which could result in temporary downtime. We are not liable for any losses incurred due to service interruptions."
    },
    {
      title: "6. Limitation of Liability",
      text: "In no event shall StockWhisk be liable for any indirect, incidental, special, or consequential damages arising out of or in connection with your use of the platform, including but not limited to loss of profits, data, or business opportunities."
    }
  ];

  const contentBn = [
    {
      title: "১. শর্তাবলীর সম্মতি",
      text: "স্টকহুইস্ক (StockWhisk) ক্লাউড পিওএস প্ল্যাটফর্ম অ্যাক্সেস এবং ব্যবহার করার মাধ্যমে, আপনি এই চুক্তির শর্তাবলী মেনে চলতে সম্মত হচ্ছেন। আপনি যদি এই শর্তগুলোর সাথে একমত না হন, তবে অনুগ্রহ করে আমাদের পরিষেবাগুলো ব্যবহার করবেন না।"
    },
    {
      title: "২. অ্যাকাউন্ট নিবন্ধন",
      text: "নিবন্ধন প্রক্রিয়ার সময় ব্যবহারকারীদের সঠিক এবং সম্পূর্ণ তথ্য প্রদান করতে হবে। আপনি আপনার অ্যাকাউন্টের তথ্যের গোপনীয়তা বজায় রাখতে এবং আপনার অ্যাকাউন্টের অধীনে ঘটে যাওয়া সমস্ত কার্যকলাপের জন্য দায়ী থাকবেন।"
    },
    {
      title: "৩. সাবস্ক্রিপশন এবং বিলিং",
      text: "স্টকহুইস্ক একটি সাবস্ক্রিপশন-ভিত্তিক পরিষেবা। পেইড প্ল্যানে সাবস্ক্রাইব করার মাধ্যমে, আপনি আমাদের আপনার নির্বাচিত পেমেন্ট মেথড থেকে চার্জ করার অনুমতি দিচ্ছেন। পরবর্তী বিলিং চক্রের আগে বাতিল না করলে সাবস্ক্রিপশন স্বয়ংক্রিয়ভাবে রিনিউ হবে। আমরা পূর্ব ঘোষণা দিয়ে মূল্য পরিবর্তন করার অধিকার রাখি।"
    },
    {
      title: "৪. ডেটা গোপনীয়তা এবং নিরাপত্তা",
      text: "আপনার ডেটার গোপনীয়তা আমাদের অগ্রাধিকার। আপনার সেলস, ইনভেন্টরি এবং কাস্টমার ডেটা সুরক্ষিত রাখতে আমরা আধুনিক নিরাপত্তা ব্যবস্থা ব্যবহার করি। আমরা তৃতীয় পক্ষের কাছে আপনার ডেটা বিক্রি করি না।"
    },
    {
      title: "৫. পরিষেবার প্রাপ্যতা (Service Availability)",
      text: "আমরা ৯৯.৯% আপটাইমের জন্য চেষ্টা করি, তবে স্টকহুইস্ক নিরবচ্ছিন্ন পরিষেবার নিশ্চয়তা দেয় না। আমরা মাঝে মাঝে রক্ষণাবেক্ষণের কাজ করতে পারি, যার ফলে সাময়িক ডাউনটাইম হতে পারে। পরিষেবা বিঘ্নিত হওয়ার কারণে কোনো ক্ষতির জন্য আমরা দায়ী নই।"
    },
    {
      title: "৬. দায়বদ্ধতার সীমাবদ্ধতা",
      text: "প্ল্যাটফর্মটি ব্যবহারের ফলে প্রত্যক্ষ বা পরোক্ষভাবে কোনো ক্ষতি, ডেটা হারানো, বা ব্যবসায়িক সুযোগ হারানোর মতো কোনো ঘটনার জন্য স্টকহুইস্ক কোনো অবস্থাতেই দায়ী থাকবে না।"
    }
  ];

  const content = isBn ? contentBn : contentEn;

  return (
    <PublicThemeProvider>
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "#f8fafc", color: "#1e293b", fontFamily: manrope.style.fontFamily }}>
        <MarketingNav />
        
        <Box component="main" sx={{ flexGrow: 1, pt: { xs: 12, md: 16 }, pb: { xs: 10, md: 16 } }}>
          <Container maxWidth="md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Typography component="h1" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 800, fontSize: { xs: "2.5rem", md: "3.5rem" }, color: "#0f172a", mb: 2, textAlign: "center" }}>
                {title}
              </Typography>
              <Typography sx={{ color: "#64748b", textAlign: "center", mb: 6, fontSize: "1.1rem" }}>
                {lastUpdated}
              </Typography>

              <Paper elevation={0} sx={{ p: { xs: 4, md: 6 }, borderRadius: "24px", bgcolor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 10px 40px rgba(0,0,0,0.03)" }}>
                {content.map((section, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    style={{ marginBottom: index !== content.length - 1 ? "2.5rem" : 0 }}
                  >
                    <Typography component="h2" sx={{ fontFamily: hanken.style.fontFamily, fontWeight: 700, fontSize: "1.5rem", color: "#0f172a", mb: 2 }}>
                      {section.title}
                    </Typography>
                    <Typography sx={{ fontSize: "1.05rem", color: "#475569", lineHeight: 1.8 }}>
                      {section.text}
                    </Typography>
                  </motion.div>
                ))}
              </Paper>
            </motion.div>
          </Container>
        </Box>

        <MarketingFooter />
      </Box>
    </PublicThemeProvider>
  );
}
