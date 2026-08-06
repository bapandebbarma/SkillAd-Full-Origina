import { motion } from "framer-motion";
import GpsAnimation from "./GpsAnimation";

export default function GpsDiscovery() {
  return (
    <section id="gps-discovery" className="py-24 md:py-28 bg-slate-50 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center max-w-3xl mx-auto mb-14"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">
            GPS Discovery
          </p>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground mb-5">
            How discovery works
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            As you move from one area to another, providers appear and disappear automatically based on
            their service coverage. No manual searching is required.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 }}
          className="flex justify-center"
        >
          <GpsAnimation />
        </motion.div>
      </div>
    </section>
  );
}
