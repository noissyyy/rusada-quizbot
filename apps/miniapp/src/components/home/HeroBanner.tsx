import { Button, Icon } from '../ui';
import { HeroIllustration } from '../illustrations/HeroIllustration';

export function HeroBanner({ onStart }: { onStart: () => void }) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden rounded-hero bg-gradient-to-br from-[#3B8BFF] via-primary to-[#1553B8] p-5 text-white shadow-raised"
    >
      {/* soft decorative orbs */}
      <span className="pointer-events-none absolute -right-10 -top-14 size-44 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -bottom-16 left-24 size-36 rounded-full bg-white/[0.07]" />
      <div className="relative flex items-center">
        <div className="z-10 w-[58%] min-w-0">
          <span className="mb-2 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white/15 px-2.5 py-1 text-micro font-semibold backdrop-blur">
            <Icon name="sparkle" size={12} filled /> Каждый день
          </span>
          <h1 id="hero-title" className="text-[22px] font-extrabold leading-[26px] tracking-tight">
            Проверь свой русский язык
          </h1>
          <p className="mt-1.5 text-caption text-white/80">Тесты по грамматике, орфографии и лексике</p>
          <Button variant="inverse" size="md" className="mt-4" onClick={onStart}
            trailing={<Icon name="play" size={16} filled />}>
            Начать тест
          </Button>
        </div>
        <HeroIllustration size={150} className="absolute -right-3 top-1/2 -translate-y-1/2 drop-shadow-xl" />
      </div>
    </section>
  );
}
