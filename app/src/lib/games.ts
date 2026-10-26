// Game knowledge packs. Chat gets the pack for whatever you're playing, so
// viewers use the right names and slang, and Whisper spells them right.
// Rosters checked October 2026. Meta and tier opinions are left out on
// purpose because they change every patch.

const uniq = (a: string[]) => [...new Set(a)];

export interface GamePack {
  id: string;
  name: string;
  match: RegExp;      // spotted in "What you're playing"
  knowledge: string;  // goes in the chat AI's instructions
  words: string[];    // names speech recognition should spell right
}

const BRAWLHALLA_LEGENDS: [string, string][] = [
  ['Bödvar', 'Hammer/Sword'], ['Cassidy', 'Hammer/Blasters'], ['Orion', 'Rocket Lance/Spear'], ['Lord Vraxx', 'Rocket Lance/Blasters'],
  ['Gnash', 'Hammer/Spear'], ['Queen Nai', 'Spear/Katars'], ['Hattori', 'Sword/Spear'], ['Thatch', 'Sword/Blasters'],
  ['Ada', 'Blasters/Spear'], ['Scarlet', 'Hammer/Rocket Lance'], ['Sentinel', 'Hammer/Katars'], ['Sir Roland', 'Rocket Lance/Sword'],
  ['Lucien', 'Katars/Blasters'], ['Teros', 'Axe/Hammer'], ['Brynn', 'Axe/Spear'], ['Asuri', 'Katars/Sword'],
  ['Barraza', 'Axe/Blasters'], ['Ember', 'Bow/Katars'], ['Azoth', 'Bow/Axe'], ['Koji', 'Bow/Sword'],
  ['Ulgrim', 'Axe/Rocket Lance'], ['Diana', 'Bow/Blasters'], ['Jhala', 'Axe/Sword'], ['Kor', 'Gauntlets/Hammer'],
  ['Wu Shang', 'Gauntlets/Spear'], ['Val', 'Gauntlets/Sword'], ['Ragnir', 'Katars/Axe'], ['Cross', 'Blasters/Gauntlets'],
  ['Mirage', 'Scythe/Spear'], ['Nix', 'Scythe/Blasters'], ['Mordex', 'Scythe/Gauntlets'], ['Yumiko', 'Hammer/Bow'],
  ['Artemis', 'Rocket Lance/Scythe'], ['Caspian', 'Gauntlets/Katars'], ['Sidra', 'Cannon/Sword'], ['Xull', 'Cannon/Axe'],
  ['Kaya', 'Spear/Bow'], ['Isaiah', 'Cannon/Blasters'], ['Jiro', 'Sword/Scythe'], ['Lin Fei', 'Katars/Cannon'],
  ['Zariel', 'Gauntlets/Bow'], ['Rayman', 'Gauntlets/Axe'], ['Dusk', 'Spear/Orb'], ['Fait', 'Scythe/Orb'],
  ['Thor', 'Hammer/Orb'], ['Petra', 'Gauntlets/Orb'], ['Vector', 'Rocket Lance/Bow'], ['Volkov', 'Axe/Scythe'],
  ['Onyx', 'Gauntlets/Cannon'], ['Jaeyun', 'Sword/Greatsword'], ['Mako', 'Katars/Greatsword'], ['Magyar', 'Hammer/Greatsword'],
  ['Reno', 'Blasters/Orb'], ['Munin', 'Bow/Scythe'], ['Arcadia', 'Spear/Greatsword'], ['Ezio', 'Sword/Orb'],
  ['Tezca', 'Gauntlets/Battle Boots'], ['Thea', 'Rocket Lance/Battle Boots'], ['Red Raptor', 'Orb/Battle Boots'], ['Loki', 'Katars/Scythe'],
  ['Seven', 'Spear/Cannon'], ['Vivi', 'Blasters/Battle Boots'], ['Imugi', 'Axe/Greatsword'], ['King Zuva', 'Hammer/Battle Boots'],
  ['Priya', 'Sword/Chakram'], ['Ransom', 'Bow/Chakram'], ['Lady Vera', 'Scythe/Chakram'], ['Rupture', 'Rocket Lance/Katars'],
  ['Aurus', 'Spear/Chakram'], ['Qinghua & Baobao', 'Cannon/Orb'],
];

const BRAWLHALLA: GamePack = {
  id: 'brawlhalla',
  name: 'Brawlhalla',
  match: /brawl\s*halla|\bbhalla\b/i,
  knowledge: `Brawlhalla: a free 2D platform fighter by Blue Mammoth Games, published by Ubisoft. Fighters are called legends. Each legend has two weapons, picked up from weapon spawns during the match, and fights unarmed until they grab one.
Weapons: Sword, Hammer, Spear, Rocket Lance, Blasters, Katars, Axe, Bow, Gauntlets, Scythe, Cannon, Orb, Greatsword, Battle Boots, Chakram.
Legends (weapons): ${BRAWLHALLA_LEGENDS.map(([n, w]) => `${n} (${w})`).join(', ')}.
How it plays: damage builds up, then a strong hit launches you off the blast zone for a KO. Stock matches, usually 3 stocks in ranked 1v1. Moves are named by input: nlight, slight, dlight (light attacks), nair, sair, dair (air attacks), recovery (rec), ground pound (gp). Each legend has unique signature attacks per weapon: nsig, ssig, dsig (neutral, side, down sig). Throwing your weapon, dodging (spot dodge, chase dodge), dashing, fast fall, wall jumps and recovering back to stage are core.
Slang chat uses: true combo, string, read, bait, dodge read, dodge spam, punish, gravity cancel (GC), edgeguard, gimp, SD (self destruct), offstage, spike, frame trap, sig spam, nlight spam, "he's on 0", "that was a read", "clean", "gg", "ez dodge".
Modes: ranked 1v1 and 2v2, Strikeout, Brawlball, Kung Foot, Brawl of the Week, Experimental, custom rooms. Gadgets: bombs, mines, spike balls, sticky bombs. Ranked tiers: Tin, Bronze, Silver, Gold, Platinum, Diamond, Valhallan. The in-game shop is Mallhalla, currencies are Gold and Mammoth Coins.`,
  // hardest to spell first, Whisper only has room for so many
  words: uniq(['Brawlhalla', 'Bödvar', 'Jhala', 'Ulgrim', 'Teros', 'Azoth', 'Barraza', 'Asuri', 'Xull', 'Zariel', 'Mordex', 'Ragnir', 'Lin Fei', 'Wu Shang', 'Qinghua & Baobao', 'Imugi', 'Tezca', 'Jaeyun', 'Magyar', 'Munin', 'Aurus', 'Priya', 'King Zuva', 'Lady Vera', 'Volkov', 'Sidra', 'Caspian', 'Yumiko', 'Hattori', 'Lucien', 'Lord Vraxx', 'nsig', 'ssig', 'dsig', 'nlight', 'sair', 'dair', 'Valhallan', 'Mallhalla', ...BRAWLHALLA_LEGENDS.map(([n]) => n)]),
};

const OW_TANK = ['D.Va', 'D.Mon', 'Domina', 'Doomfist', 'Hazard', 'Junker Queen', 'Mauga', 'Orisa', 'Ramattra', 'Reinhardt', 'Roadhog', 'Sigma', 'Winston', 'Wrecking Ball', 'Zarya'];
const OW_DAMAGE = ['Anran', 'Ashe', 'Bastion', 'Cassidy', 'Echo', 'Emre', 'Freja', 'Genji', 'Hanzo', 'Junkrat', 'Mei', 'Pharah', 'Reaper', 'Shion', 'Sierra', 'Sojourn', 'Soldier: 76', 'Sombra', 'Symmetra', 'Torbjörn', 'Tracer', 'Vendetta', 'Venture', 'Widowmaker'];
const OW_SUPPORT = ['Ana', 'Baptiste', 'Brigitte', 'Doctrine', 'Illari', 'Jetpack Cat', 'Juno', 'Kiriko', 'Lifeweaver', 'Lúcio', 'Mercy', 'Mizuki', 'Moira', 'Wuyang', 'Zenyatta'];

const OVERWATCH: GamePack = {
  id: 'overwatch',
  name: 'Overwatch',
  match: /over\s*watch|\bow2?\b/i,
  knowledge: `Overwatch: Blizzard's team hero shooter. Called Overwatch 2 until February 2026, when it was renamed back to just Overwatch with the Reign of Talon story year. Seasons restarted at Season 1 then. Season 5 started October 6, 2026.
Teams are 5v5: 1 tank, 2 damage (DPS), 2 support. There are also 6v6 modes. Roles have sub-roles with their own passives.
Tanks: ${OW_TANK.join(', ')}.
Damage: ${OW_DAMAGE.join(', ')}.
Supports: ${OW_SUPPORT.join(', ')}.
Newest heroes: Vendetta (damage, sword fighter, Dec 2025), Season 1 2026 added Domina (tank, shield that breaks in sections), Anran (damage, fire ultimate that can revive her), Emre (damage), Mizuki (support), and Jetpack Cat (support, an orange tabby with a jetpack who can rope enemies off the map and carry allies). Then Sierra (damage, Season 2), Shion (damage, Omnic leader of the Hashimoto clan, pistols and a bike, Season 3), D.Mon (tank, plasma saber and power barrier, Season 4), Doctrine (support, a vampire whose scepter heals allies and hurts enemies, Season 5).
Modes: Control, Escort, Hybrid, Push, Flashpoint, Clash. Quick Play, Competitive, Arcade, Stadium (best of 7 rounds, third person, buy upgrades between rounds). Perks: you pick upgrades twice during a match. Competitive ranks: Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster, Champion, Top 500.
Ultimates and lingo chat uses: ult, ult econ, "my ult is ready", Nano Blade, Grav (Graviton Surge), Dragonblade, Earthshatter (Shatter), D.Va bomb, Rein pin, Mercy rez, Mercy pocket, Ana sleep and nade, Kiriko Suzu, Lúcio boop and speed, Zen discord, Widow headshot, Hanzo spam, Junkrat spam, Sombra hack, Bastion, POTG (play of the game), team wipe (team kill), dive, brawl, poke, peel, flank, off-angle, high ground, staggering, spawn camping, counterswap, one-trick, tank diff, DPS diff, support diff, "gg go next", "heal me", "group up", OWCS (the pro league).`,
  words: uniq(['Overwatch', 'Kiriko', 'Lúcio', 'Zenyatta', 'Baptiste', 'Illari', 'Lifeweaver', 'Wuyang', 'Mizuki', 'Jetpack Cat', 'Doctrine', 'Domina', 'D.Mon', 'Anran', 'Emre', 'Shion', 'Sierra', 'Vendetta', 'Venture', 'Sojourn', 'Ramattra', 'Mauga', 'Junker Queen', 'Torbjörn', 'Symmetra', 'Freja', 'Juno', 'Zarya', 'Orisa', 'D.Va', 'Reign of Talon', 'Flashpoint', ...OW_TANK, ...OW_DAMAGE, ...OW_SUPPORT]),
};

export const GAME_PACKS: GamePack[] = [BRAWLHALLA, OVERWATCH];

/** Packs that apply: picked by hand, plus any spotted in what you're playing. */
export function activePacks(s: { gamePacks: string[]; gamesAuto: boolean; topic: string }) {
  return GAME_PACKS.filter(p => s.gamePacks.includes(p.id) || (s.gamesAuto && p.match.test(s.topic)));
}
