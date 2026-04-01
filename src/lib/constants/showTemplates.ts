export interface ShowTemplateClass {
  name: string;
  classNumber?: string;
  isNanQualifying?: boolean;
}

export interface ShowTemplateDivision {
  name: string;
  classes: ShowTemplateClass[];
}

export interface ShowTemplate {
  key: string;
  label: string;
  description: string;
  divisions: ShowTemplateDivision[];
}

export const SHOW_TEMPLATES: ShowTemplate[] = [
  // ─── Template 1: Standard Halter (NAMHSA Style) ───
  {
    key: "standard_halter",
    label: "🐴 Standard Halter (NAMHSA Style)",
    description:
      "Traditional breed-based halter classes used in most NAMHSA live shows. 5 divisions, 17 classes.",
    divisions: [
      {
        name: "Light Breeds",
        classes: [
          { name: "Arabian", classNumber: "101" },
          { name: "Part-Arabian", classNumber: "102" },
          { name: "Morgan", classNumber: "103" },
          { name: "Saddlebred", classNumber: "104" },
          { name: "Other Light/Gaited", classNumber: "105" },
        ],
      },
      {
        name: "Sport Breeds",
        classes: [
          { name: "Thoroughbred/Standardbred", classNumber: "106" },
          { name: "Warmblood", classNumber: "107" },
          { name: "Carriage Breeds", classNumber: "108" },
          { name: "Other Sport", classNumber: "109" },
        ],
      },
      {
        name: "Stock Breeds",
        classes: [
          { name: "Quarter Horse", classNumber: "110" },
          { name: "Appaloosa", classNumber: "111" },
          { name: "Paint", classNumber: "112" },
          { name: "Mustang", classNumber: "113" },
          { name: "Other Stock", classNumber: "114" },
        ],
      },
      {
        name: "Draft & Pony",
        classes: [
          { name: "British Draft", classNumber: "115" },
          { name: "European Draft", classNumber: "116" },
          { name: "American Pony", classNumber: "117" },
          { name: "European Pony", classNumber: "118" },
        ],
      },
      {
        name: "Other",
        classes: [
          { name: "Longears/Exotics", classNumber: "119" },
          { name: "Foals", classNumber: "120" },
        ],
      },
    ],
  },

  // ─── Template 2: Performance Standard ───
  {
    key: "performance_standard",
    label: "🏇 Performance Standard",
    description:
      "Discipline-based performance classes. Western, English, and specialty events. 3 divisions, 13 classes.",
    divisions: [
      {
        name: "Western",
        classes: [
          { name: "Western Pleasure", classNumber: "201" },
          { name: "Western Trail", classNumber: "202" },
          { name: "Western Games", classNumber: "203" },
          { name: "Stock Work/Cutting/Roping", classNumber: "204" },
        ],
      },
      {
        name: "English",
        classes: [
          { name: "Huntseat Pleasure", classNumber: "205" },
          { name: "Hunter over Fences", classNumber: "206" },
          { name: "Jumper", classNumber: "207" },
          { name: "Dressage", classNumber: "208" },
          { name: "Cross Country", classNumber: "209" },
        ],
      },
      {
        name: "Other Performance",
        classes: [
          { name: "Harness/Driving", classNumber: "210" },
          { name: "Costume", classNumber: "211" },
          { name: "Scene", classNumber: "212" },
          { name: "Showmanship", classNumber: "213" },
        ],
      },
    ],
  },

  // ─── Template 3: Collectibility & Fun ───
  {
    key: "collectibility_fun",
    label: "✨ Collectibility & Fun",
    description:
      "Collector-focused and casual fun classes. Perfect for casual community shows. 2 divisions, 8 classes.",
    divisions: [
      {
        name: "Breyer Collectibility",
        classes: [
          { name: "Vintage (Pre-1990)", classNumber: "301" },
          { name: "Decorator/Woodgrain", classNumber: "302" },
          { name: "Glossy Finish", classNumber: "303" },
          { name: "Limited/Special Run", classNumber: "304" },
        ],
      },
      {
        name: "Fun Classes",
        classes: [
          { name: "Best Customization", classNumber: "305" },
          { name: "Unrealistic Color", classNumber: "306" },
          { name: "Fails & Flaws", classNumber: "307" },
          { name: "Fantasy/Unicorn", classNumber: "308" },
        ],
      },
    ],
  },
];
