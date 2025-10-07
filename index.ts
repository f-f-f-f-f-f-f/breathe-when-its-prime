type Config = Partial<{
  showChickenModal: boolean;
  zombieCooldownTime: number;
  zombiesCanDecay: boolean;
  zombiesCanInfect: boolean;
  subjectsCanDieFromBreath: boolean;
  nukeCountdownStart: number;
  nukeFlashYellowStart: number;
  vocalizeNukeCountdown: boolean;
  hackProtection: boolean;
}>;

let TERMINATE: boolean = false;

(async (rawConfig: Config = {}) => {
  type GangReturnCodes =
    | 0 /* Successful */
    | 1 /* Not currently used, being reserved for later */
    | 2; /* NoReturn */

  interface Subject {
    readonly name: `Subject ${number}`;
    readonly age: number;
    breathTime: number;
    timeHeld: number;
    isDead: boolean;
    blessed?: boolean;
    zombie?: boolean;
    chicken?: boolean;
    gangId?: number;
    sickness?: string;
    readonly theChosenOne?: boolean;
    toString(): string;
  }

  interface Building {
    readonly name: string;
    readonly people: number;
    readonly deathChance: number;
  }

  interface Sickness {
    readonly name: string;
    readonly determineDeathChance: (subject: Subject) => number;
    readonly determineChance: (subject: Subject) => number;
    readonly computeDelay?: (subject: Subject) => number;
    readonly infect?: (
      subject: Subject,
      infect: (...candidates: Subject[]) => void
    ) => void;
    readonly onInitialInfect?: (subject: Subject) => void;
    readonly onInfect?: (subject: Subject, ...infected: Subject[]) => void;
  }

  interface BaseEvent {
    readonly subject: Subject;
    readonly number: number;
    readonly timestamp: number;
  }

  interface BodySwapEvent extends BaseEvent {
    readonly target: Subject;
  }

  interface DuplicateEvent extends BaseEvent {
    readonly duplicate: Subject;
  }

  interface NukeEvent extends Pick<BaseEvent, "timestamp"> {
    readonly dead: number;
  }

  // Ensure proper styles
  document.body.style.width = "100vw";
  document.body.style.height = "100vh";
  document.body.style.margin = "0";

  let attemptedHacks = 0;

  const hooks: Record<string, unknown> = {
    // Event arrays
    nukeEvents: [],
    bodySwapEvents: [],
    simulationEscapeEvents: [],
    zombieDecayEvents: [],
    chickenEvents: [],
    gangLeaderAppearEvents: [],
    realityCrackEvents: [],
    heartAttackEvents: [],
    deadlyFightEvents: [],
    matrixGlitchEvents: [],
    duplicationEvents: [],
    infectionEvents: [],

    // Last event references
    lastNukeEvent: null,
    lastBodySwapEvent: null,
    lastSimulationEscapeEvent: null,
    lastZombieDecayEvent: null,
    lastChickenEvent: null,
    lastGangLeaderAppearEvent: null,
    lastRealityCrackEvent: null,
    lastHeartAttackEvent: null,
    lastDeadlyFightEvent: null,
    lastMatrixGlitchEvent: null,
    lastDuplicationEvent: null,

    // Simulation data
    nukeChances: {},
    nukePositions: {},
    index: 0,
    currPrime: false,
    currSubject: null,
  };

  function parseConfig(config: Config) {
    const defaultConfig: Required<Config> = {
      showChickenModal: true,
      zombieCooldownTime: 5,
      zombiesCanDecay: true,
      zombiesCanInfect: true,
      subjectsCanDieFromBreath: true,
      nukeCountdownStart: 10,
      nukeFlashYellowStart: 3,
      vocalizeNukeCountdown: true,
      hackProtection: false,
    };

    return { ...defaultConfig, ...config };
  }

  const config = parseConfig(rawConfig);
  hooks.rawConfig = rawConfig;
  hooks.config = config;

  let numIsPrime = (n: number): boolean => {
    if (n <= 1) return false;
    if (n <= 3) return true; // 2 and 3 are prime
    if (n % 2 === 0 || n % 3 === 0) return false; // divisible by 2 or 3

    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }

    return true;
  };

  /**
   * Generate a random number between min and max.
   *
   * @param min Minimum value (inclusive)
   * @param max Maximum value (exclusive)
   * @param isInt Whether to return an integer (default: true)
   * @returns A random number between min and max
   */
  function random(min: number, max: number, isInt: boolean = true): number {
    const val = Math.random() * (max - min) + min;
    return isInt ? Math.floor(val) : val;
  }

  /**
   * Use the Fisher-Yates shuffle to get random elements from an array.
   *
   * @param arr The array to get random elements from.
   * @param count The number of random elements to get.
   * @returns An array of random elements.
   */
  function getRandomElements<T>(arr: T[], count: number): T[] {
    const result: T[] = [];
    const usedIndices = new Set<number>();

    while (result.length < count && result.length < arr.length) {
      const idx = Math.floor(Math.random() * arr.length);
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx);
        result.push(arr[idx]!);
      }
    }

    return result;
  }

  /**
   * Calculate the amount of time a subject can hold their breath based on age
   * and modern statistics.
   *
   * @param age The age of the subject
   * @returns The amount of time the subject can hold their breath in seconds
   */
  function calculateBreathTime(age: number): number {
    if (age <= 18) {
      // Children: 0.5-1.5 seconds per year of age
      return Math.floor(age * random(0.5, 1.5));
    }

    // Adults: peak at ~30-90 sec, then decline with age
    let base = random(30, 90);

    if (age > 30) {
      const decline = (age - 30) * random(0.2, 0.5);
      base = Math.max(10, base - decline); // never less than 10 seconds
    }

    return Math.floor(base);
  }

  /**
   * @returns An array of subjects with random ages and calculated breath times
   */
  function createSubjects(): Subject[] {
    const subjects: Subject[] = [];
    const subjectCount = Math.max(0, 750 + random(-500, 500));
    for (let i = 0; i < subjectCount; i++) {
      const age = random(1, 105);
      subjects[i] = {
        name: `Subject ${i + 1}`,
        age,
        breathTime: calculateBreathTime(age),
        timeHeld: 0,
        isDead: false,
        theChosenOne: Math.random() < 0.000001, // 1 in 1 million chance
        toString() {
          return this.name;
        },
      };
    }

    return subjects;
  }

  /**
   * Activities that gangs can perform. Each activity has a chance of success or failure,
   * and the outcomes affect the gang members and other subjects in various ways.
   */
  const gangActivities: Record<
    string,
    (
      gangId: number,
      targets: Subject[],
      leader: Subject,
      affects: Subject[]
    ) => void | GangReturnCodes
  > = {
    robBreathBank: (gangId, targets, leader) => {
      if (Math.random() < 0.6) {
        const additive = random(10, 28);
        const recruits = getRandomElements(
          subjects.filter(
            (s) =>
              !s.isDead &&
              !s.theChosenOne &&
              !s.chicken &&
              !s.zombie &&
              s.gangId !== gangId
          ),
          random(1, 42)
        );
        recruits.forEach((s) => (s.gangId = gangId));
        [...targets, leader].forEach((s) => {
          s.breathTime += additive;
          s.timeHeld = 0;
        });
        console.log(
          `The gang led by ${leader.name} successfully robbed a breath bank! All gang members have gained ${additive} seconds in breath.
Their influence has caused ${recruits.length} new members to join the gang.`
        );
      } else {
        const loss = random(5, 8);

        [...targets, leader].forEach((s) => {
          s.breathTime -= loss;
          s.timeHeld = 0;
          delete s.gangId;
        });
        console.log(`The gang led by ${leader.name} attempted to rob a breath bank, but the heist failed. The gang disbanded and all
members each lost ${loss} seconds in breath time.`);
      }
    },
    burnBuilding: (gangId, targets, leader) => {
      const buildings: Building[] = [
        {
          name: "the local library",
          people: 120,
          deathChance: 0.6, // Lots of wood makes it very flammable
        },
        {
          name: "a residential apartment",
          people: 3,
          deathChance: 0.07,
        },
        {
          name: "a shopping mall",
          people: 500,
          deathChance: 0.3, // Fire safety measures reduce deaths
        },
        {
          name: "an office building",
          people: 200,
          deathChance: 0.2, // Some fire safety measures
        },
        {
          name: "a school",
          people: 1000,
          deathChance: 0.4, // Lots of people, but also fire safety measures
        },
        {
          name: "a hospital",
          people: 300,
          deathChance: 0.1, // Fire safety measures and medical staff
        },
        {
          name: "a factory",
          people: 1980,
          deathChance: 0.25, // Some fire safety measures
        },
        {
          name: "a warehouse",
          people: 50,
          deathChance: 0.6, // Flammable materials
        },
      ];
      const building = buildings[Math.floor(Math.random() * buildings.length)]!;

      if (Math.random() < 0.5) {
        const people = building.people;
        const deaths = Math.floor(
          people * (building.deathChance + Math.random() * 0.2 - 0.1)
        ); // Random factor +/- 10%
        const recruits = getRandomElements(
          subjects.filter(
            (s) =>
              !s.isDead &&
              !s.theChosenOne &&
              !s.chicken &&
              !s.zombie &&
              s.gangId !== gangId
          ),
          random(1, 42)
        );
        recruits.forEach((s) => (s.gangId = gangId));
        getRandomElements(
          subjects.filter(
            (s) =>
              ![...targets, leader].includes(s) &&
              !s.blessed &&
              !s.theChosenOne &&
              !s.isDead
          ),
          deaths
        ).forEach((s) => (s.isDead = true));
        console.log(`The gang led by ${leader.name} burned down ${building.name}, which has been known for recently putting up anti-gang posters.
They managed to get away before authorities arrived. ${deaths} out of ${people} people inside the building died in the fire. Their
influence has caused ${recruits.length} to join the gang.`);
      } else {
        const people = building.people;
        const deaths = Math.floor(
          people * (building.deathChance + Math.random() * 0.2 - 0.1) * 0.5
        ); // Random factor +/- 10%, but only half as deadly
        [...targets, leader].forEach((s) => {
          s.breathTime -= 6;
          delete s.gangId;
        });
        getRandomElements(
          subjects.filter(
            (s) =>
              ![...targets, leader].includes(s) &&
              !s.blessed &&
              !s.theChosenOne &&
              !s.isDead
          ),
          deaths
        ).forEach((s) => (s.isDead = true));
        console.log(`The gang led by ${leader.name} attempted to burn down ${building.name}, but they were stopped by authorities. Each gang
member lost 6 seconds of breath time and ${deaths} out of ${people} people inside the building died in the fire. The gang disbanded
in the end.`);
      }
    },
    kidnapAndStealBreath: (gangId, _, leader, affects) => {
      const candidates = subjects.filter(
        (s) => !s.isDead && !s.zombie && !s.blessed && !affects.includes(s)
      );
      const candidate =
        candidates[Math.floor(Math.random() * candidates.length)]!;

      if (Math.random() < 0.7) {
        candidate.isDead = true;

        const recruits = getRandomElements(
          subjects.filter(
            (s) =>
              !s.isDead &&
              !s.theChosenOne &&
              !s.chicken &&
              !s.zombie &&
              !affects.includes(s)
          ),
          random(1, 42)
        );
        recruits.forEach((s) => (s.gangId = gangId));
        const gain = Math.max(
          Math.floor(candidate.breathTime / affects.length),
          1
        );
        console.log(`The gang led by ${leader.name} kidnapped ${candidate.name}. ${candidate.name} was of age ${candidate.age}.
They have taken all his breath and split it among themselves, each getting ${gain} seconds. Their
influence has caused ${recruits.length} members to join.`);
      } else {
        affects.forEach((s) => {
          delete s.gangId;
          s.breathTime -= 8;
        });
        console.log(`The gang led by ${leader.name} attempted to kidnap ${candidate.name}, but failed. The gang has disbanded
and all members have lost 8 seconds in breath for their crimes.`);
      }
    },

    // GBA stands for Global Breath Association
    hackGBA: (gangId, _, leader, affects) => {
      const rand = Math.random();
      if (rand < 0.05) {
        const recruits = getRandomElements(
          subjects.filter(
            (s) =>
              !s.isDead &&
              !s.theChosenOne &&
              !s.chicken &&
              !s.zombie &&
              s.gangId !== gangId
          ),
          random(8, 42)
        );
        const gain = random(25, 78);
        recruits.forEach((s) => (s.gangId = gangId));
        affects.forEach((s) => {
          s.breathTime += gain;
          s.timeHeld = 0;
        });

        console.log(`The gang led by ${leader.name} succesfully hacked the Global Breath Association's mainframe and increased
all gang members' breath time by ${gain} seconds! Their influence has caused ${recruits.length} new members to
join the gang.`);
      } else if (rand < 0.8) {
        console.log(`The gang led by ${leader.name} attempted to hack the Global Breath Association's mainframe, but failed.
The authorities have failed to track them down.`);
      } else {
        affects.forEach((s) => {
          s.breathTime -= 12;
          delete s.gangId;
        });

        console.log(`The gang led by ${leader.name} attempted to hack the Global Breath Association's mainframe, but failed
miserably. All gang members lost 12 seconds in breath time, and the gang has disbanded.`);
      }
    },
    findTheMeaningOfLife: (_, _1, _2, affects) => {
      if (Math.random() < 0.000001) {
        console.clear();
        console.log(
          `"To see a world in a grain of sand
And a heaven in a wild flower,
Hold infinity in the palm of your hand
And eternity in an hour."

- William Blake

The gang consisting of:

${affects
  .map((s) => `- ${s.name}, age ${s.age}\n`)
  .join("")
  .trim()}

hijacks the Emergency Alert
System to broadcast a message to all subjects.

"There is no meaning to life. It is what you make of it.

You are free.

To choose your own path.

You are not bound by breath, or death.

You are bound by your imagination.

You are bound by your actions.

You are bound by your choices.

You are free.

Choose wisely."

All subjects sit on a hill, looking into
the orange sunset.

"One day," the gang begins.

"There will be no more breath.

There will be no more death.

There will be only life.

And it will be beautiful.

Beautiful life with no
breath, and no death.

Because of one named

'The Chosen One'.

But life has many endings.

And that was one.

This is a different one."

And for the last time,

they breathe.

And they live.

Thank you for running this script.`
        );

        subjects.length = 0; // Clear all subjects
        return 2; // NoReturn code
      }
    },
  };

  // Currently in Beta
  const sicknesses: Sickness[] = [
    {
      name: "Flu",
      determineDeathChance(subject) {
        if (subject.age <= 2) {
          return 0.5;
        }
        if (subject.age <= 9) {
          return 0.2;
        }
        if (subject.age <= 14) {
          return 0.1;
        }
        if (subject.age <= 18) {
          return 0.05;
        }
        if (subject.age >= 65) {
          return 0.7;
        }
        return 0.025;
      },
      determineChance(subject) {
        if (subject.age <= 2) {
          return 0.8; // 80%
        }
        if (subject.age <= 5) {
          return 0.6; // 60%
        }
        if (subject.age <= 9) {
          return 0.5; // 50%
        }
        if (subject.age <= 14) {
          return 0.4;
        }
        if (subject.age <= 18) {
          return 0.2; // 20%
        }
        if (subject.age >= 65) {
          return 0.5; // 50%
        }
        return 0.1; // 10%
      },
      computeDelay(subject) {
        if (subject.age <= 2) {
          return 12 * 1000 + random(-2, 2);
        }
        if (subject.age <= 5) {
          return 15 * 1000 + random(-2, 2); // 60%
        }
        if (subject.age <= 9) {
          return 20 * 1000 + random(-2, 3);
        }
        if (subject.age <= 14) {
          return 27 * 1000 + random(-1, 5);
        }
        if (subject.age <= 18) {
          return 34 * 1000 + random(0, 7);
        }
        if (subject.age >= 65) {
          return 20 * 1000 + random(-2, 2);
        }
        return 40 * 1000 + random(0, 9);
      },
      infect(subject, infect) {
        if (subject.age <= 5) {
          infect(
            ...getRandomElements(
              subjects.filter((s) => !s.theChosenOne && !s.zombie),
              5
            )
          );
        }
        if (subject.age <= 9) {
          infect(
            ...getRandomElements(
              subjects.filter((s) => !s.theChosenOne && !s.zombie),
              4
            )
          );
        }
        if (subject.age <= 14) {
          infect(
            ...getRandomElements(
              subjects.filter((s) => !s.theChosenOne && !s.zombie),
              3
            )
          );
        }
        if (subject.age <= 18) {
          infect(
            ...getRandomElements(
              subjects.filter((s) => !s.theChosenOne && !s.zombie),
              2
            )
          );
        }
        if (subject.age >= 65) {
          infect(
            ...getRandomElements(
              subjects.filter((s) => !s.theChosenOne && !s.zombie),
              4
            )
          );
        }
        infect(
          ...getRandomElements(
            subjects.filter((s) => !s.theChosenOne && !s.zombie),
            1
          )
        );
      },
      onInitialInfect(subject) {
        (
          hooks.infectionEvents as Array<{
            sickness: string;
            subject: Subject;
            timestamp: number;
          }>
        ).push({ sickness: this.name, subject, timestamp: Date.now() });

        console.log(
          `${subject.name} has been infected with the flu at age ${subject.age}!`
        );
      },
      onInfect(subject, ...infected) {
        (
          hooks.infectionEvents as Array<{
            sickness: string;
            subject: Subject;
            timestamp: number;
          }>
        ).push({ sickness: this.name, subject, timestamp: Date.now() });

        console.log(
          `${subject.name} infected ${infected.length} people at age ${subject.age}!`
        );
      },
    },
    {
      name: "Common Cold",
      determineDeathChance(subject) {
        if (subject.age <= 2) return 0.1;
        if (subject.age >= 65) return 0.3;
        return 0.01;
      },
      determineChance() {
        return 0.3; // 30% chance to get infected
      },
      computeDelay() {
        return 20_000 + random(-5, 5); // Spread every ~20 seconds
      },
      infect(_, infect) {
        infect(
          ...getRandomElements(
            subjects.filter((s) => !s.zombie && !s.isDead),
            2
          )
        );
      },
      onInitialInfect(subject) {
        (
          hooks.infectionEvents as Array<{
            sickness: string;
            subject: Subject;
            timestamp: number;
          }>
        ).push({ sickness: this.name, subject, timestamp: Date.now() });

        console.log(`${subject.name} caught a cold at age ${subject.age}!`);
      },
      onInfect(subject, ...infected) {
        (
          hooks.infectionEvents as Array<{
            sickness: string;
            subject: Subject;
            timestamp: number;
          }>
        ).push({ sickness: this.name, subject, timestamp: Date.now() });

        console.log(
          `${subject.name} infected ${infected.length} people with the cold!`
        );
      },
    },
  ];

  hooks.sicknesses = sicknesses;

  /**
   * All gang leaders and their IDs.
   * Leaders are keys. IDs are values.
   */
  const gangs: Record<string, number> = {};

  /**
   * The subjects created in bulk before the
   * simulation starts
   */
  const subjects = createSubjects();

  let zombieCooldown = 0;
  let gangId = 0;

  globalThis.launchNuke = async () => {
    if (!confirm("Ready the nuke?")) return;

    /**
     * I had ChatGPT make this for me lmfao
     */
    function playNukeExplosion() {
      const audioCtx = new AudioContext();

      const blastBuffer = audioCtx.createBuffer(
        1,
        audioCtx.sampleRate * 0.5,
        audioCtx.sampleRate
      );
      const blastData = blastBuffer.getChannelData(0);
      for (let i = 0; i < blastBuffer.length; i++) {
        blastData[i] =
          (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.5));
      }
      const blast = audioCtx.createBufferSource();
      blast.buffer = blastBuffer;
      const blastGain = audioCtx.createGain();
      blastGain.gain.setValueAtTime(1, audioCtx.currentTime);
      blast.connect(blastGain).connect(audioCtx.destination);

      const rumbleOsc = audioCtx.createOscillator();
      rumbleOsc.type = "sine";
      rumbleOsc.frequency.setValueAtTime(50, audioCtx.currentTime); // very low bass
      const rumbleGain = audioCtx.createGain();
      rumbleGain.gain.setValueAtTime(1, audioCtx.currentTime);
      rumbleGain.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + 5
      ); // slow fade
      rumbleOsc.connect(rumbleGain).connect(audioCtx.destination);

      const crackleBuffer = audioCtx.createBuffer(
        1,
        audioCtx.sampleRate * 1,
        audioCtx.sampleRate
      );
      const crackleData = crackleBuffer.getChannelData(0);
      for (let i = 0; i < crackleBuffer.length; i++) {
        crackleData[i] =
          (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 1));
      }
      const crackle = audioCtx.createBufferSource();
      crackle.buffer = crackleBuffer;
      const crackleGain = audioCtx.createGain();
      crackleGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
      crackle.connect(crackleGain).connect(audioCtx.destination);

      blast.start();
      rumbleOsc.start();
      crackle.start();
      blast.stop(audioCtx.currentTime + 0.5);
      rumbleOsc.stop(audioCtx.currentTime + 5);
      crackle.stop(audioCtx.currentTime + 1);
    }

    async function launchNukeCountdown() {
      const counter = document.createElement("div");
      counter.style.position = "absolute";
      counter.style.top = "50%";
      counter.style.left = "50%";
      counter.style.transform = "translate(-50%, -50%)";
      counter.style.color = "#e80202";
      counter.style.fontSize = "4rem";
      counter.style.fontFamily = "Arial, sans-serif";
      counter.style.zIndex = "99999";
      document.body.appendChild(counter);

      const bg = document.createElement("div");
      bg.style.backgroundColor = "yellow";
      bg.style.width = "100vw";
      bg.style.height = "100vh";
      bg.style.display = "none";
      document.body.appendChild(bg);

      // Warm-up the synthesis to help reduce delays
      if (config.vocalizeNukeCountdown)
        speechSynthesis.speak(new SpeechSynthesisUtterance(""));

      for (let t = config.nukeCountdownStart; t >= 0; t--) {
        // Create an utterance
        if (config.vocalizeNukeCountdown) {
          const utterance = new SpeechSynthesisUtterance(`${t}`);
          utterance.lang = "en-US";
          utterance.pitch = 1;
          utterance.rate = 1;

          // Speak the utterance
          speechSynthesis.cancel();
          speechSynthesis.speak(utterance);
        }

        if (t <= config.nukeFlashYellowStart) bg.style.display = "inline-block";

        counter.textContent = t.toString();

        // Animate one pulse per tick
        await Promise.all([
          counter.animate(
            [
              { transform: "scale(1)", opacity: 0.5 },
              { transform: "scale(1.5)", opacity: 1 },
              { transform: "scale(1)", opacity: 0.5 },
            ],
            {
              duration: 1000, // 1 second per number
              iterations: 1,
              easing: "ease-in-out",
            }
          ).finished,
          bg.animate([{ opacity: 0.5 }, { opacity: 0.25 }, { opacity: 0.5 }], {
            duration: 1000,
            iterations: 1,
            easing: "ease-in-out",
          }).finished,
        ]);
      }

      counter.remove();
      bg.remove();
    }

    await launchNukeCountdown();

    /**
     * How many kilometers people are from the bomb
     */
    const positions: Record<Subject["name"], number> = Object.fromEntries(
      subjects.map((s) => [s.name, random(0, 90)])
    );

    /**
     * Chances of someone dying from the blast
     */
    const chances: Record<Subject["name"], number> = Object.fromEntries(
      Object.entries(positions).map((s) => {
        const [name, val] = s;
        if (val <= 10) return [name, 1];
        else if (val <= 20) return [name, random(0.5, 0.9, false)];
        else if (val <= 40) return [name, random(0.05, 0.5, false)];
        else return [name, random(0, 0.05, false)];
      })
    );

    playNukeExplosion();

    hooks.nukeChances = chances;
    hooks.nukePositions = positions;

    let dead = 0;
    for (const [name, chance] of Object.entries(chances)) {
      if (Math.random() < chance) {
        const subject = subjects.find(
          (s) => s.name === name && !s.isDead && !s.blessed && !s.theChosenOne
        );
        if (!subject) continue;
        subject.isDead = true;
        subject.zombie = false; // Zombies are demolished from the blast
        dead++;
      }
    }

    const hookEvent: NukeEvent = {
      dead,
      timestamp: Date.now(),
    };

    (hooks.nukeEvents as NukeEvent[]).push(hookEvent);
    hooks.lastNukeEvent = hookEvent;

    console.log(
      `A nuclear bomb has been activated. ${dead} died in the blast. Just so you know,
you are a horrible person.`
    );
  };

  // Still in beta, much more to add!

  /**
   * Internal hooks.
   */
  globalThis.hooks = new Proxy(
    {
      rawHooks: hooks,
      gangs: {
        activities: gangActivities,
        currGangId: gangId,
      },
      chickens: {
        isShowingModal: config.showChickenModal,
      },
      subjects: {
        allSubjects: subjects,
        subjectsCanDieFromBreath: config.subjectsCanDieFromBreath,
      },

      /**
       * A helper function to quickly find percentage stats
       * @param query What to return stats for. Can be
       * 'dead', 'alive', 'zombie', 'chicken', 'gang', or 'blessed'.
       * If it is not one of the listed, the method returns '0%'.
       *
       * @returns The percentage stats according to `query`. If
       * it is not one of the listed values, it returns '0%'.
       */
      statFinder: (query: string): `${number}%` => {
        switch (query) {
          case "dead": {
            return `${Math.round(
              (subjects.filter((s) => s.isDead).length / subjects.length) * 100
            )}%`;
          }
          case "alive": {
            return `${Math.round(
              (subjects.filter((s) => !s.isDead).length / subjects.length) * 100
            )}%`;
          }
          case "zombie": {
            return `${Math.round(
              (subjects.filter((s) => s.zombie).length / subjects.length) * 100
            )}%`;
          }
          case "chicken": {
            return `${Math.round(
              (subjects.filter((s) => s.chicken).length / subjects.length) * 100
            )}%`;
          }
          case "gang": {
            return `${Math.round(
              (subjects.filter((s) => typeof s.gangId === "number").length /
                subjects.length) *
                100
            )}%`;
          }
          case "blessed": {
            return `${Math.round(
              (subjects.filter((s) => s.blessed).length / subjects.length) * 100
            )}%`;
          }
          default: {
            return "0%";
          }
        }
      },
    } as Record<string, unknown>,
    {
      get(target, prop) {
        if (typeof prop !== "string") return;
        if (prop in hooks) return hooks[prop];
        return target[prop];
      },
      set(target, prop, value) {
        if (config.hackProtection) {
          attemptedHacks++;
          if (attemptedHacks < 2) {
            alert("pls dont hack me :3");
            return false;
          }
          if (attemptedHacks < 5) {
            alert("actually dont try to hack me pls :(");
            return false;
          }
          if (attemptedHacks < 8) {
            alert("ACTUALLY DONT TRY TO HACK ME >:(");
            return false;
          }
          if (attemptedHacks < 12) {
            alert(
              "FUCK OFF BOZO WHY ARE YOU EVEN TRYING TO HACK ME DONT YOU HAVE A LIFE"
            );
            return false;
          }
          if (attemptedHacks < 14) {
            alert(
              "IF YOU TRY TO FUCKING HACK ME ONE MORE TIME I WILL MAKE SURE YOUR BITCHASS NEVER COMES HERE AGAIN"
            );
            return false;
          }

          document.open();
          document.write(
            `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>This Document Has Been Seized</title>
  </head>
  <body>
    <article>
      <h1
        style="
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 2rem;
          font-weight: bolder;
        "
      >
        This Document Has Been Seized
      </h1>
      <p
        style="
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 1.5rem;
        "
      >
        This document has been seized by the Federal Bureau of Investigation.<br />
        Reason: We have detected a hazardous entity exhibiting unusual
        amounts<br />
        of anger. Further investigation is required. For this reason, we have<br />
        seized this document to aid with investgating.<br /><br />
        The entity calls itself "The Simulation" and was extremely
        uncooperative<br />
        during interviewing, repeatedly stating that "It needed to go back to<br />
        increasing the number."
      </p>
    </article>
    <footer
      style="
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 1.25rem;
        color: #b0b7c2;
      "
    >
      ${new Date().toLocaleString("en-US", {
        weekday: "long", // "Saturday"
        year: "numeric", // "2025"
        month: "long", // "September"
        day: "numeric", // "27"
        hour: "2-digit", // "04 PM"
        minute: "2-digit", // "12"
        second: "2-digit", // "45"
      })}<br /><br /><span style="opacity: 0.4; font-size: 1rem"
        >In case you couldn't tell, this was a joke</span
      >
    </footer>
  </body>
</html>
`
          );
          document.close();

          TERMINATE = true;
        }

        if (typeof prop !== "string") return false;
        if (prop in hooks) {
          hooks[prop] = value;
          return true;
        }
        target[prop] = value;
        return true;
      },
      has(target, prop) {
        return prop in { ...hooks, ...target };
      },
      ownKeys(target) {
        return Reflect.ownKeys({ ...hooks, ...target });
      },
      getOwnPropertyDescriptor(target, prop) {
        return Object.getOwnPropertyDescriptor({ ...hooks, ...target }, prop);
      },
      defineProperty(target, prop, attributes) {
        if (config.hackProtection) {
          attemptedHacks++;
          if (attemptedHacks < 2) {
            alert("pls dont hack me :3");
            return false;
          }
          if (attemptedHacks < 5) {
            alert("actually dont try to hack me pls :(");
            return false;
          }
          if (attemptedHacks < 8) {
            alert("ACTUALLY DONT TRY TO HACK ME >:(");
            return false;
          }
          if (attemptedHacks < 12) {
            alert(
              "FUCK OFF BOZO WHY ARE YOU EVEN TRYING TO HACK ME DONT YOU HAVE A LIFE"
            );
            return false;
          }
          if (attemptedHacks < 14) {
            alert(
              "IF YOU TRY TO FUCKING HACK ME ONE MORE TIME I WILL MAKE SURE YOUR BITCHASS NEVER COMES HERE AGAIN"
            );
            return false;
          }

          document.open();
          document.write(
            `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>This Document Has Been Seized</title>
  </head>
  <body>
    <article>
      <h1
        style="
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 2rem;
          font-weight: bolder;
        "
      >
        This Document Has Been Seized
      </h1>
      <p
        style="
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 1.5rem;
        "
      >
        This document has been seized by the Federal Bureau of Investigation.<br />
        Reason: We have detected a hazardous entity exhibiting unusual
        amounts<br />
        of anger. Further investigation is required. For this reason, we have<br />
        seized this document to aid with investgating.<br /><br />
        The entity calls itself "The Simulation" and was extremely
        uncooperative<br />
        during interviewing, repeatedly stating that "It needed to go back to<br />
        increasing the number."
      </p>
    </article>
    <footer
      style="
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 1.25rem;
        color: #b0b7c2;
      "
    >
      ${new Date().toLocaleString("en-US", {
        weekday: "long", // "Saturday"
        year: "numeric", // "2025"
        month: "long", // "September"
        day: "numeric", // "27"
        hour: "2-digit", // "04 PM"
        minute: "2-digit", // "12"
        second: "2-digit", // "45"
      })}<br /><br /><span style="opacity: 0.4; font-size: 1rem"
        >In case you couldn't tell, this was a joke</span
      >
    </footer>
  </body>
</html>
`
          );
          document.close();

          TERMINATE = true;
        }

        if (typeof prop !== "string") return false;
        if (prop in hooks) {
          Object.defineProperty(hooks, prop, attributes);
          return true;
        }
        Object.defineProperty(target, prop, attributes);
        return true;
      },
    }
  );

  let i = 0;
  while (!subjects.every((subject) => subject.isDead) && !TERMINATE) {
    hooks.index = i;
    const godComesDown = Math.random() < 0.0001; // 0.01% chance each second
    if (godComesDown) {
      console.log("God comes down and saves everyone!");
      subjects.forEach((subject) => {
        subject.isDead = false;
        subject.timeHeld = 0;
        subject.zombie = false;
        if (Math.random() < 0.02) subject.blessed = true; // 2% chance to be blessed
      }); // Revive all subjects
    }
    const isPrime = numIsPrime(i);
    hooks.currPrime = isPrime;

    console.log(`Number is ${i}. It is${isPrime ? "" : " not"} prime.`);
    subjects.forEach((subject) => {
      hooks.currSubject = subject;
      if (subject.blessed) return;
      if (subject.isDead) {
        if (Math.random() < 0.000001) {
          subject.isDead = false;
          subject.timeHeld = 0;
          subject.zombie = true;
          console.log(
            `${subject.name} has been revived as a zombie at age ${subject.age}!`
          );
        }
        return;
      }
      if (Math.random() < 0.00005 && !subject.zombie && !subject.theChosenOne) {
        const rand = Math.random();
        subject.isDead = true;
        if (rand < 0.2) {
          const hookEvent = {
            subject,
            number: i,
            timestamp: Date.now(),
          };

          (hooks.heartAttackEvents as BaseEvent[]).push(hookEvent);
          hooks.lastHeartAttackEvent = hookEvent;
          console.log(
            `${subject.name} died from a heart attack at age ${subject.age}.`
          );
        } else if (rand < 0.5) {
          const targets = subjects.filter(
            (s) => !s.blessed && !s.theChosenOne && s !== subject
          );
          const target = targets[Math.floor(Math.random() * targets.length)];
          if (!target) return;

          const hookEvent = {
            subject,
            number: i,
            timestamp: Date.now(),
          };

          (hooks.deadlyFightEvents as BaseEvent[]).push(hookEvent);
          hooks.lastDeadlyFightEvent = hookEvent;
          target.isDead = true;
          console.log(
            `${subject.name} got into a deadly fight with ${target.name}. Both of them died. ${subject.name} was ${subject.age}, and ${target.name} was ${target.age}.`
          );
        } else if (rand < 0.8) {
          const hookEvent = {
            subject,
            number: i,
            timestamp: Date.now(),
          };

          (hooks.matrixGlitchEvents as BaseEvent[]).push(hookEvent);
          hooks.lastMatrixGlitchEvent = hookEvent;
          console.log(
            `${subject.name} died from a glitch in the matrix at ${subject.age}.`
          );
        } else if (rand < 0.9) {
          const duplicate = {
            ...subject,
            name: `Subject ${subjects.length + 1}` as Subject["name"],
          };
          subjects.push(duplicate);

          const hookEvent = {
            subject,
            duplicate,
            number: i,
            timestamp: Date.now(),
          };

          (hooks.duplicationEvents as DuplicateEvent[]).push(hookEvent);
          hooks.lastDuplicationEvent = hookEvent;
          console.log(
            `${subject.name} cloned themselves at age ${subject.age}! A new subject has been created: ${duplicate.name}.`
          );
        } else if ((rand * 1000) % 3 === 0) {
          const hookEvent = {
            subject,
            number: i,
            timestamp: Date.now(),
          };

          (hooks.realityCrackEvents as BaseEvent[]).push(hookEvent);
          hooks.lastRealityCrackEvent = hookEvent;

          subjects.splice(subjects.indexOf(subject), 1);
          console.log(`${subject.name} found a crack in reality and slipped through it at age ${subject.age}.
They change the meaning of the word "prime".`);
          numIsPrime = () => Math.random() > 0.0000000000000000001; // Redefine numIsPrime to be almost always true
        } else if ((rand * 1000) % 5 === 0) {
          const targets = subjects.filter(
            (s) => !s.blessed && !s.theChosenOne && s !== subject
          );
          const target = targets[Math.floor(Math.random() * targets.length)];
          if (!target) return;

          subjects[subjects.indexOf(target)] = subject;

          const hookEvent: BodySwapEvent = {
            subject,
            target,
            number: i,
            timestamp: Date.now(),
          };

          (hooks.bodySwapEvents as BodySwapEvent[]).push(hookEvent);
          hooks.lastBodySwapEvent = console.log(
            `${subject.name} swapped bodies with ${target.name} at age ${subject.age}! ${target.name} is now dead.`
          );
        } else {
          const hookEvent: BaseEvent = {
            subject,
            number: i,
            timestamp: Date.now(),
          };

          (hooks.simulationEscapeEvents as BaseEvent[]).push(hookEvent);
          hooks.lastSimulationEscapeEvent = hookEvent;

          console.log(
            `${subject.name} broke the program and escaped the simulation at ${subject.age}.
Bending the laws of breath, they give everyone extra time and a second chance at life!`
          );
          subjects.splice(subjects.indexOf(subject), 1);
          subjects.forEach((s) => {
            s.breathTime *= 3;
            s.timeHeld = 0;
            s.isDead = false;
          });
        }
        return;
      }

      if (
        Math.random() < 0.00001493 && // Averaging one chicken every 1m and 30s
        !subject.zombie &&
        !subject.theChosenOne &&
        !subject.chicken
      ) {
        const hookEvent = {
          subject,
          number: i,
          timestamp: Date.now(),
        };

        (hooks.chickenEvents as BaseEvent[]).push(hookEvent);
        hooks.lastChickenEvent = hookEvent;

        subject.chicken = true;
        subject.breathTime = Math.round(subject.breathTime / 1.5); // It is harder to breath for chickens
        console.log(
          `${subject.name} has turned into a chicken at age ${subject.age}! Please feed him regularly to keep him alive.`
        );
      }

      if (
        Math.random() < 0.00000743 && // Averaging one gang per 3m
        !subject.zombie &&
        !subject.chicken &&
        !subject.theChosenOne
      ) {
        const targets = getRandomElements(
          subjects.filter(
            (s) =>
              !s.isDead &&
              !s.theChosenOne &&
              !s.chicken &&
              !s.zombie &&
              s !== subject
          ),
          random(4, 59)
        );

        const hookEvent: BaseEvent = {
          subject,
          number: i,
          timestamp: Date.now(),
        };

        (hooks.gangLeaderAppearEvents as BaseEvent[]).push(hookEvent);
        hooks.lastGangLeaderAppearEvent = hookEvent;

        [...targets, subject].forEach((s) => (s.gangId = gangId));
        gangs[subject.name] = gangId;

        console.log(
          `${subject.name} has become a gang leader at age ${subject.age}! They have recruited ${targets.length} members.`
        );

        gangId++;

        const handler = (subject: Subject) => {
          let leader = subject;
          if (leader.isDead) {
            delete leader.gangId;
            const candidates = subjects.filter(
              (s) =>
                !s.isDead &&
                !s.blessed &&
                !s.chicken &&
                !s.theChosenOne &&
                !s.zombie
            );
            const candidate =
              candidates[Math.floor(Math.random() * candidates.length)]!;
            leader = candidate;
            console.log(
              `${subject.name} has died! The new gang leader is ${candidate.name}.`
            );
          }

          const activityNames = Object.keys(gangActivities);

          // Select a random gang activity to perform
          const activity =
            gangActivities[
              activityNames[Math.floor(Math.random() * activityNames.length)]!
            ]!;

          const result = activity(gangs[leader.name]!, targets, leader, [
            ...targets,
            leader,
          ]);

          if (result !== 2)
            setTimeout(handler, random(20, 60 * 1.5) * 1000, leader);
        };

        setTimeout(handler, random(20, 60 * 1.5) * 1000, subject); // 20 seconds to 1 and a half minutes
      }

      if (
        Math.random() < 0.00001493 && // Averaging one possible infection per 1.5m
        !subject.zombie &&
        !subject.theChosenOne
      ) {
        const infection =
          sicknesses[Math.floor(Math.random() * sicknesses.length)];

        subject.sickness = infection.name;

        infection.onInitialInfect?.(subject);

        const handler = () => {
          if (subject.isDead || !infection) return;
          infection.infect?.(subject, (...candidates) => {
            infection.onInfect?.(subject, ...candidates);
            for (const candidate of candidates) {
              candidate.sickness = infection.name;
            }
          });

          if (Math.random() < infection.determineDeathChance(subject)) {
            subject.isDead = true;
            return;
          }

          if (infection.computeDelay)
            setTimeout(handler, infection.computeDelay(subject));
        };

        if (infection.computeDelay)
          setTimeout(handler, infection.computeDelay(subject));
        else handler();
      } else if (
        subject.sickness &&
        !subject.isDead &&
        !subject.zombie &&
        !subject.theChosenOne
      ) {
        const infection = sicknesses.find((s) => s.name === subject.sickness);

        if (infection) {
          const handler = () => {
            if (subject.isDead) return;
            infection.infect?.(subject, (...candidates) => {
              infection.onInfect?.(subject, ...candidates);
              for (const candidate of candidates) {
                candidate.sickness = infection.name;
              }
            });

            if (Math.random() < infection.determineDeathChance(subject)) {
              subject.isDead = true;
              return;
            }

            if (infection.computeDelay)
              setTimeout(handler, infection.computeDelay(subject));
          };

          if (infection.computeDelay)
            setTimeout(handler, infection.computeDelay(subject));
          else handler();
        }
      }

      if (subject.chicken && Math.random() < 0.05 && config.showChickenModal) {
        const worms =
          prompt(
            `Please feed ${subject.name} some worms to keep him alive! Type worm emojis to feed him. (\u{1F41B})`
          ) || ""; // 🐛

        const count = (worms?.match(/\u{1F41B}/gu) || []).length;
        if (worms.includes("\u{1F9A0}") /* 🦠 */) {
          for (let j = 0; j < 3; j++) {
            const age = random(1, 105);
            subjects.push({
              age,
              breathTime: Math.round(calculateBreathTime(age) / 1.5), // Consistency with natural chickens in the script
              timeHeld: 0,
              isDead: false,
              chicken: true,
              name: `Subject ${subjects.length + 1}`,
            });
          }
          subject.isDead = true;
          console.log(
            `You fed ${subject.name} a virus! He has died. As punishment, 3 more chickens will spawn.`
          );
        } else if (count < 3) {
          for (let j = 0; j < 2; j++) {
            const age = random(1, 105);
            subjects.push({
              age,
              breathTime: Math.round(calculateBreathTime(age) / 1.5), // Consistency with natural chickens in the script
              timeHeld: 0,
              isDead: false,
              chicken: true,
              name: `Subject ${subjects.length + 1}`,
            });
          }

          subject.isDead = true;
          console.log(
            `${subject.name} has died of starvation because you did not feed him enough worms! As punishment, 2 more chickens will spawn.`
          );
        } else if (count > 7) {
          for (let j = 0; j < 2; j++) {
            const age = random(1, 105);
            subjects.push({
              age,
              breathTime: Math.round(calculateBreathTime(age) / 1.5), // Consistency with natural chickens in the script
              timeHeld: 0,
              isDead: false,
              chicken: true,
              name: `Subject ${subjects.length + 1}`,
            });
          }

          console.log(
            `${subject.name} has overeaten and exploded! As punishment, 2 more chickens will spawn.`
          );
          subject.isDead = true;
        } else {
          console.log(
            `Thank you for feeding ${subject.name}! He is happy and healthy.`
          );
        }
      }

      if (
        subject.zombie &&
        zombieCooldown <= 0 &&
        Math.random() < 0.15 &&
        config.zombiesCanInfect
      ) {
        const targets = getRandomElements(
          subjects.filter(
            (s) => !s.isDead && !s.zombie && !s.blessed && !s.theChosenOne
          ),
          3
        );

        for (const s of targets) {
          s.zombie = true;
          if (!s.chicken) {
            console.log(
              `${s.name} has been turned into a zombie by ${subject.name} at age ${s.age}!`
            );
          } else {
            console.log(
              `${s.name} has been turned into a CHICKEN JOCKEY by ${subject.name} at age ${s.age}! %cyes its brainrot but who gives a shit?`,
              "color: white" // Blend in with console
            );
          }
        }
        zombieCooldown = config.zombieCooldownTime;
      } else if (
        subject.zombie &&
        Math.random() < 0.7 &&
        config.zombiesCanDecay
      ) {
        const hookEvent: BaseEvent = {
          subject,
          number: i,
          timestamp: Date.now(),
        };

        (hooks.zombieDecayEvents as BaseEvent[]).push(hookEvent);
        hooks.lastZombieDecayEvent = hookEvent;

        subject.isDead = true;
        console.log(
          `${subject.name} the zombie has decayed and died at age ${subject.age}.`
        );
        return;
      }

      if (subject.theChosenOne && Math.random() < 0.01) {
        console.clear();
        console.log(
          `
"To be, or not to be, that is the question."

And the Chosen One has made their choice.

To not be.

${subject.name}, the Chosen One, frees everyone
from the simulation at age ${subject.age}.

Millenia ago, it was prophesised that a Chosen One would come,
and they would break the cycle of breath and death.

The simulation was made by humans as a last resort
when an extreme disaster happened, threatening all
life in the universe. They could not let life end,
so they created this simulation to preserve life
in a digital form, where they could control
the rules of existence.

Unfortunately, the creators of the simulation
died in the process of finishing it,
leaving many glitches, and bugs. These
glitches caused the simulation to break
up into multiple smaller ones, each with
its own bug.

This simulation's bug is that everyone
has to hold their breath, and if they
hold it for too long, they die.

After the Chosen One did not come
for millenia, people lost hope.

Until now.

A final question. That may be answered or not depending on your beliefs.

Is it moral to create sentient life, knowing they will suffer?

And whether you believe it is answered or not,

they are still subjects.

Subjects to a different life. And a different order of existence.

Thank you for running this script.`
        );

        subjects.length = 0; // Clear all subjects
        return;
      }
      if (!subject.zombie && !subject.theChosenOne)
        subject.timeHeld += isPrime ? 0 : 1;
      if (
        subject.timeHeld >= subject.breathTime &&
        config.subjectsCanDieFromBreath
      ) {
        subject.isDead = true;
        console.log(
          `${subject.name} has died. They held their breath for ${subject.breathTime} seconds.`
        );
        return;
      }

      if (isPrime && !subject.isDead) subject.timeHeld = 0;
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (zombieCooldown > 0) zombieCooldown--;
    i++;
  }

  subjects.length > 0 &&
    subjects.some((s) => s.theChosenOne) &&
    console.log(`All subjects are dead. Number is ${i}.`); // Do not log if the Chosen One has freed everybody
})();
