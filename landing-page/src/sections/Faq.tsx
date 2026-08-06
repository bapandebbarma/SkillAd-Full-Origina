import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { fetchContent, type FaqItem } from "@/lib/api";

export default function Faq() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchContent()
      .then((c) => {
        const list = Array.isArray(c.faqs) ? c.faqs : [];
        // Only render FAQ entries that have a real question from CMS — never inject samples.
        setFaqs(
          list.filter(
            (f) => typeof f?.question === "string" && f.question.trim().length > 0,
          ),
        );
      })
      .catch(() => setFaqs([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <section id="faq" className="py-24 bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Frequently asked questions
          </h2>
          <p className="text-lg text-muted-foreground">Answers from our help content.</p>
        </div>

        {!loaded && (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading FAQs…</div>
        )}

        {loaded && faqs.length === 0 && (
          <div className="rounded-2xl border border-border bg-white p-12 text-center text-sm text-muted-foreground">
            No FAQs have been published yet.
          </div>
        )}

        {faqs.length > 0 && (
          <Accordion type="single" collapsible className="rounded-2xl border border-border bg-white px-6 shadow-sm">
            {faqs.map((faq, i) => (
              <AccordionItem key={faq.id || i} value={faq.id || `faq-${i}`}>
                <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </section>
  );
}
