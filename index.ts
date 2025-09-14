(async () => {
  interface Subject {
    name: string;
    age: number;
    breathTime: number;
    timeHeld: number;
    isDead: boolean;
    blessed?: boolean;
    zombie?: boolean;
    chicken?: boolean;
    inGang?: boolean;
    theChosenOne?: boolean;
    toString: () => string;
  }

  let numIsPrime = (n: number) => {
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
   * Remove a specified number of random elements from an array.
   *
   * @param array The array to remove elements from.
   * @param count The number of elements to remove.
   * @return The array with the specified number of random elements removed.
   */
  function removeRandomElements<T>(array: T[], count: number) {
    const shuffled = array.sort(() => 0.5 - Math.random());
    const remaining = shuffled.slice(count);
    return remaining;
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
        result.push(arr[idx]);
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
    const base = Math.floor(random(1.5, 2.5) * Math.min(age, 18)); // base breath time scales with age, max for age 18
    const minorRandom = random(0.2, 0.7); // small random addition

    if (age <= 18) {
      return Math.max(1, Math.floor((base * age) / 18)); // scale linearly for kids
    }

    const decline = age > 30 ? Math.floor((age - 18) * random(0.5, 1)) : 0;
    return Math.max(base + minorRandom - decline, 3); // ensure at least 3 seconds
  }

  /**
   *
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
          return JSON.stringify(this);
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
    (targets: Subject[], leader: Subject, affects: Subject[]) => void
  > = {
    robBreathBank: (targets: Subject[], leader: Subject) => {
      if (Math.random() < 0.6) {
        const additive = random(10, 78);
        const recruits = getRandomElements(
          subjects.filter(
            (s) =>
              !s.isDead &&
              !s.theChosenOne &&
              !s.chicken &&
              !s.zombie &&
              !s.inGang
          ),
          random(1, 42)
        );
        recruits.forEach((s) => (s.inGang = true));
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
          s.inGang = false;
        });
        console.log(`The gang led by ${leader.name} attempted to rob a breath bank, but the heist failed. The gang disbanded and all
members each lost ${loss} seconds in breath time.`);
      }
    },
    burnBuilding: (targets: Subject[], leader: Subject) => {
      interface Building {
        name: string;
        people: number;
        deathChance: number;
      }

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
      const building =
        buildings[Math.floor(Math.random() * Object.keys(buildings).length)];

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
              !s.inGang
          ),
          random(1, 42)
        );
        recruits.forEach((s) => (s.inGang = true));
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
          s.inGang = false;
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
    kidnapAndStealBreath: (_, leader, affects) => {
      const candidates = subjects.filter(
        (s) => !s.isDead && !s.zombie && !s.blessed && !affects.includes(s)
      );
      const candidate =
        candidates[Math.floor(Math.random() * candidates.length)];

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
        recruits.forEach((s) => (s.inGang = true));
        const gain = Math.max(
          Math.floor(candidate.breathTime / affects.length),
          1
        );
        console.log(`The gang led by ${leader.name} kidnapped ${candidate.name}. ${candidate.name} was of age ${candidate.age}.
They have taken all his breath and split it among themselves, each getting ${gain} seconds. Their
influence has caused ${recruits.length} members to join.`);
      } else {
        affects.forEach((s) => {
          s.inGang = false;
          s.breathTime -= 8;
        });
        console.log(`The gang led by ${leader.name} attempted to kidnap ${candidate.name}, but failed. The gang has disbanded
and all members have lost 8 seconds in breath for their crimes.`);
      }
    },
  };

  const subjects = createSubjects();
  (globalThis as any)["subjects"] = subjects;

  let zombieCooldown = 0;

  let i = 0;
  while (!subjects.every((subject) => subject.isDead)) {
    const godComesDown = Math.random() < 0.0001; // 0.01% chance each second
    if (godComesDown) {
      console.log(
        "%cGod comes down and saves everyone!",
        'color: gold; font-size: 20px; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;'
      );
      subjects.forEach((subject) => {
        subject.isDead = false;
        subject.timeHeld = 0;
        subject.zombie = false;
        if (Math.random() < 0.02) subject.blessed = true; // 2% chance to be blessed
      }); // Revive all subjects
    }
    const isPrime = numIsPrime(i);
    console.log(`Number is ${i}. It is${isPrime ? "" : " not"} prime.`);
    subjects.forEach((subject) => {
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
          console.log(
            `${subject.name} died from a heart attack at age ${subject.age}.`
          );
        } else if (rand < 0.5) {
          const target = subjects.filter(
            (s) => !s.isDead && !s.blessed && !s.theChosenOne && s !== subject
          )[0];
          if (!target) return;
          target.isDead = true;
          console.log(
            `${subject.name} got into a deadly fight with ${target.name}. Both of them died. ${subject.name} was ${subject.age}, and ${target.name} was ${target.age}.`
          );
        } else if (rand < 0.8) {
          console.log(
            `${subject.name} died from a glitch in the matrix at ${subject.age}.`
          );
        } else if (rand < 0.9) {
          const duplicate = {
            ...subject,
            name: `Subject ${subjects.length + 1}`,
          };
          subjects.push(duplicate);
          console.log(
            `${subject.name} cloned themselves at age ${subject.age}! A new subject has been created: ${duplicate.name}.`
          );
        } else if ((rand * 1000) % 3 === 0) {
          subjects.splice(subjects.indexOf(subject), 1);
          console.log(`${subject.name} found a crack in reality and slipped through it at age ${subject.age}.
They change the meaning of the word "prime".`);
          numIsPrime = () => Math.random() > 0.0000000000000000001; // Redefine numIsPrime to be almost always true
        } else if ((rand * 1000) % 5 === 0) {
          const target = subjects.filter(
            (s) => !s.blessed && !s.theChosenOne && s !== subject
          )[0];
          if (!target) return;

          subjects[subjects.indexOf(target)] = subject;

          console.log(
            `${subject.name} swapped bodies with ${target.name} at age ${subject.age}! ${target.name} is now dead.`
          );
        } else {
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
        Math.random() < 0.0001 &&
        !subject.zombie &&
        !subject.theChosenOne &&
        !subject.chicken
      ) {
        subject.chicken = true;
        subject.breathTime *= 2; // Unrealistic, but who cares
        console.log(
          `${subject.name} has turned into a chicken at age ${subject.age}! Please feed him regularly to keep him alive.`
        );
      }

      if (
        Math.random() < 0.00001 &&
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
          random(4, 78)
        );

        [...targets, subject].forEach((s) => (s.inGang = true));

        console.log(
          `${subject.name} has become a gang leader at age ${subject.age}! They have recruited ${targets.length} members.`
        );

        const handler = () => {
          const activityNames = Object.keys(gangActivities);

          // Select a random gang activity to perform
          const acitivity =
            gangActivities[
              activityNames[Math.floor(Math.random() * activityNames.length)]
            ];

          acitivity(targets, subject, [...targets, subject]);

          setTimeout(handler, random(20, 60 * 1.5) * 1000);
        };

        setTimeout(handler, random(20, 60 * 1.5) * 1000); // 20 seconds to 1 and a half minutes
      }

      if (subject.chicken && Math.random() < 0.05) {
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
              breathTime: calculateBreathTime(age),
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
              breathTime: calculateBreathTime(age),
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
              breathTime: calculateBreathTime(age),
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

      if (subject.zombie && zombieCooldown <= 0 && Math.random() < 0.15) {
        for (const s of getRandomElements(
          subjects.filter(
            (s) => !s.isDead && !s.zombie && !s.blessed && !s.theChosenOne
          ),
          3
        )) {
          s.zombie = true;
          if (!s.chicken) {
            console.log(
              `${s.name} has been turned into a zombie by ${subject.name} at age ${s.age}!`
            );
          } else {
            console.log(
              `${s.name} has been turned into CHICKEN JOCKEY by ${subject.name} at age ${s.age}! %cyes its brainrot but who gives a shit?`,
              'color: white' // Blend in with console
            );
          }
        }
        zombieCooldown = 5; // 5 seconds cooldown
      } else if (subject.zombie && Math.random() < 0.7) {
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
      if (subject.timeHeld >= subject.breathTime) {
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
