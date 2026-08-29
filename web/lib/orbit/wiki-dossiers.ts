import { constellationFromName } from "@/lib/orbit/constellation";
import { overlayFromDossiers, type OverlayDossier } from "@/lib/orbit/overlay";
import type { SatelliteOverlayMap, VisibleSatellite } from "@/lib/orbit/types";

/** Cited Wikimedia / NASA thumbnail for the identity card. Not Cala evidence. */
export type WikiImage = {
  url: string;
  alt: string;
  credit: string;
};

/** Public-source brief for the demo page. Not a live Cala lookup. */
export type WikiBrief = {
  operator: string;
  ultimateParent: string;
  country: string;
  purpose: string;
  blurb: string;
  colorKey: string;
  sources: Array<{ name: string; url: string }>;
  image?: WikiImage;
};

const wiki = (
  operator: string,
  parent: string,
  country: string,
  purpose: string,
  blurb: string,
  colorKey: string,
  sources: Array<{ name: string; url: string }>,
  image?: WikiImage,
): WikiBrief => ({
  operator,
  ultimateParent: parent,
  country,
  purpose,
  blurb,
  colorKey,
  sources,
  image,
});

const WIKI: Record<string, WikiBrief> = {
  ISS: wiki(
    "ISS partnership (NASA, Roscosmos, ESA, JAXA, CSA)",
    "International Space Station",
    "International",
    "Crewed laboratory and staging post in low Earth orbit",
    "The International Space Station is a modular crewed outpost assembled in orbit from 1998. Partner agencies share operations; visiting vehicles (Soyuz, Crew Dragon, Progress, Cygnus) come and go.",
    "iss-facility",
    [
      { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/International_Space_Station" },
      { name: "NASA", url: "https://www.nasa.gov/international-space-station/" },
    ],
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/International_Space_Station_after_undocking_of_STS-132.jpg/960px-International_Space_Station_after_undocking_of_STS-132.jpg",
      alt: "The International Space Station after Space Shuttle Atlantis undocked",
      credit: "NASA / Wikimedia Commons",
    },
  ),
  CSS: wiki(
    "China Manned Space Agency",
    "China National Space Administration",
    "China",
    "Crewed space station (Tiangong)",
    "Tiangong is China's modular space station (Tianhe core, Wentian and Mengtian labs). Tianzhou cargo and Shenzhou crew vehicles service it.",
    "cmsa-tiangong",
    [
      { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Tiangong_space_station" },
      { name: "CMSA", url: "https://en.cmse.gov.cn/" },
    ],
  ),
  CREW: wiki(
    "SpaceX",
    "SpaceX",
    "United States",
    "Crewed transport to the ISS (Dragon 2)",
    "Crew Dragon is SpaceX's NASA-certified capsule for ISS crew rotation under Commercial Crew.",
    "spacex-dragon",
    [
      { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/SpaceX_Dragon_2" },
      { name: "NASA", url: "https://www.nasa.gov/humans-in-space/commercial-space/commercial-crew-program/" },
    ],
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Crew_Dragon_Endeavour_approaching_ISS.jpg/960px-Crew_Dragon_Endeavour_approaching_ISS.jpg",
      alt: "Crew Dragon approaching the International Space Station",
      credit: "NASA / Wikimedia Commons",
    },
  ),
  DRAGON: wiki(
    "SpaceX",
    "SpaceX",
    "United States",
    "Crewed / cargo transport (Dragon)",
    "Dragon is SpaceX's ISS visiting vehicle family. Crew Dragon carries astronauts; Cargo Dragon carries supplies.",
    "spacex-dragon",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/SpaceX_Dragon_2" }],
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Crew_Dragon_Endeavour_approaching_ISS.jpg/960px-Crew_Dragon_Endeavour_approaching_ISS.jpg",
      alt: "A SpaceX Dragon capsule approaching the International Space Station",
      credit: "NASA / Wikimedia Commons",
    },
  ),
  PROGRESS: wiki(
    "Roscosmos",
    "Roscosmos",
    "Russia",
    "Uncrewed ISS cargo resupply",
    "Progress is the Russian automated cargo ship that refuels and restocks the ISS, derived from Soyuz.",
    "roscosmos-progress",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Progress_(spacecraft)" }],
  ),
  SOYUZ: wiki(
    "Roscosmos",
    "Roscosmos",
    "Russia",
    "Crewed transport to the ISS",
    "Soyuz is Russia's long-running crewed ferry to the ISS and the station's lifeboat while docked.",
    "roscosmos-soyuz",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Soyuz_(spacecraft)" }],
  ),
  CYGNUS: wiki(
    "Northrop Grumman",
    "Northrop Grumman",
    "United States",
    "ISS cargo resupply (Cygnus)",
    "Cygnus is Northrop Grumman's uncrewed cargo vehicle for NASA's Commercial Resupply Services to the ISS.",
    "northrop-cygnus",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Cygnus_(spacecraft)" }],
  ),
  SHENZHOU: wiki(
    "China Manned Space Agency",
    "CNSA",
    "China",
    "Crewed transport to Tiangong",
    "Shenzhou is China's crewed spacecraft, used to rotate taikonauts through the Tiangong station.",
    "cmsa-shenzhou",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Shenzhou_(spacecraft)" }],
  ),
  TIANZHOU: wiki(
    "China Manned Space Agency",
    "CNSA",
    "China",
    "Tiangong cargo resupply",
    "Tianzhou is the uncrewed cargo ship that refuels and restocks Tiangong.",
    "cmsa-tianzhou",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Tianzhou" }],
  ),
  FREGAT: wiki(
    "NPO Lavochkin (Fregat upper stage)",
    "Roscosmos",
    "Russia",
    "Spent upper stage / related debris",
    "Fregat is a restartable upper stage built by NPO Lavochkin. Objects tagged Fregat in the catalog are typically the spent stage or fragments, not an active payload.",
    "lavochkin-fregat",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Fregat" }],
  ),
  SENTINEL: wiki(
    "European Space Agency",
    "European Union / ESA Copernicus",
    "Europe",
    "Earth observation (Copernicus)",
    "Sentinel satellites are the Copernicus programme's operational Earth-observation fleet, managed with ESA.",
    "esa-sentinel",
    [
      { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Copernicus_Programme" },
      { name: "ESA", url: "https://www.esa.int/Applications/Observing_the_Earth/Copernicus" },
    ],
  ),
  COSMOS: wiki(
    "Russian / Soviet space programme (Kosmos series)",
    "Roscosmos / Ministry of Defence (varies by mission)",
    "Russia",
    "Mixed military and scientific missions (Kosmos designation)",
    "Kosmos (Cosmos) is a long-running designation for Soviet and Russian satellites. Individual missions range from recon to science; the name alone does not identify a single operator.",
    "kosmos-series",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Kosmos_(satellite)" }],
  ),
  TERRA: wiki(
    "NASA",
    "NASA",
    "United States",
    "Earth observing system (climate and land)",
    "Terra (EOS AM-1) is NASA's flagship Earth-observing satellite, flying instruments that map land, ocean, and atmosphere.",
    "nasa-terra",
    [
      { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Terra_(satellite)" },
      { name: "NASA", url: "https://terra.nasa.gov/" },
    ],
  ),
  AQUA: wiki(
    "NASA",
    "NASA",
    "United States",
    "Earth observing system (water cycle)",
    "Aqua (EOS PM-1) studies Earth's water cycle with MODIS and other instruments, flying in the A-Train.",
    "nasa-aqua",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Aqua_(satellite)" }],
  ),
  ENVISAT: wiki(
    "European Space Agency",
    "ESA",
    "Europe",
    "Earth observation (retired)",
    "Envisat was ESA's large Earth-observation satellite (2002). It is now defunct but still tracked as a bright object.",
    "esa-envisat",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Envisat" }],
  ),
  ERS: wiki(
    "European Space Agency",
    "ESA",
    "Europe",
    "Radar Earth observation (ERS)",
    "ERS-1/2 were ESA's first European Remote Sensing satellites, pioneering civilian SAR from polar orbit.",
    "esa-ers",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/European_Remote-Sensing_Satellite" }],
  ),
  ALOS: wiki(
    "JAXA",
    "JAXA",
    "Japan",
    "Land observation (radar / optical)",
    "ALOS (Daichi) is JAXA's Advanced Land Observing Satellite series for mapping and disaster monitoring.",
    "jaxa-alos",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Advanced_Land_Observation_Satellite" }],
  ),
  SEASAT: wiki(
    "NASA / JPL",
    "NASA",
    "United States",
    "Ocean radar (historical)",
    "Seasat (1978) was the first civilian satellite dedicated to ocean radar remote sensing.",
    "nasa-seasat",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Seasat" }],
  ),
  HELIOS: wiki(
    "CNES / French Ministry of Defence",
    "France",
    "France",
    "Optical reconnaissance",
    "Hélios is a French military optical reconnaissance series. Public details of the payload are limited.",
    "cnes-helios",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/H%C3%A9lios_(satellite)" }],
  ),
  SAOCOM: wiki(
    "CONAE",
    "CONAE",
    "Argentina",
    "L-band radar Earth observation",
    "SAOCOM is Argentina's L-band SAR constellation for soil moisture, emergencies, and ice.",
    "conae-saocom",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/SAOCOM" }],
  ),
  SPACEMOBILE: wiki(
    "AST SpaceMobile",
    "AST SpaceMobile",
    "United States",
    "Direct-to-cell broadband from space",
    "BlueBird / SpaceMobile satellites are AST SpaceMobile's LEO network aimed at connecting ordinary phones.",
    "ast-spacemobile",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/AST_SpaceMobile" }],
  ),
  "COSMO-SKYMED": wiki(
    "Italian Space Agency (ASI) / Italian Ministry of Defence",
    "Italy",
    "Italy",
    "X-band radar Earth observation",
    "COSMO-SkyMed is Italy's dual-use SAR constellation for civilian mapping and defence reconnaissance.",
    "asi-cosmoskymed",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/COSMO-SkyMed" }],
  ),
  YAOGAN: wiki(
    "China (Yaogan reconnaissance series)",
    "CNSA / PLA (varies by mission)",
    "China",
    "Remote sensing / reconnaissance (Yaogan designation)",
    "Yaogan is a Chinese catalog name for a large remote-sensing series. Individual flights may be civilian or military; open sources rarely name a single operator.",
    "china-yaogan",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Yaogan" }],
  ),
  ADEOS: wiki(
    "JAXA",
    "JAXA",
    "Japan",
    "Earth observation (ADEOS / Midori)",
    "ADEOS (Midori) was JAXA's Advanced Earth Observing Satellite series. Midori II (ADEOS-II) flew climate and ocean instruments.",
    "jaxa-adeos",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Adeos_II" }],
  ),
  AJISAI: wiki(
    "JAXA",
    "JAXA",
    "Japan",
    "Geodetic laser ranging (Experimental Geodetic Satellite)",
    "Ajisai (EGS) is a passive Japanese geodetic satellite covered in mirrors, used for satellite laser ranging and as a bright visual object.",
    "jaxa-ajisai",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Ajisai" }],
  ),
  ACS3: wiki(
    "NASA",
    "NASA",
    "United States",
    "Solar-sail technology demonstration",
    "ACS3 (Advanced Composite Solar Sail System) is a NASA smallsat demonstrating composite boom solar-sail deployment.",
    "nasa-acs3",
    [{ name: "NASA", url: "https://www.nasa.gov/mission/acs3/" }],
  ),
  HXMT: wiki(
    "Chinese Academy of Sciences",
    "CNSA",
    "China",
    "X-ray astronomy (Insight / Huiyan)",
    "HXMT (Insight, Huiyan) is China's first X-ray astronomy satellite, studying black holes, neutron stars, and gamma-ray bursts.",
    "cas-hxmt",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Hard_X-ray_Modulation_Telescope" }],
  ),
  ISIS: wiki(
    "Defence Research Board / CRC (Canada)",
    "Canada",
    "Canada",
    "Ionospheric research (historical)",
    "ISIS (International Satellites for Ionospheric Studies) were Canadian ionosphere research satellites from the 1960s–70s, still tracked as debris/hardware.",
    "canada-isis",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/ISIS_(satellite)" }],
  ),
  OKEAN: wiki(
    "Yuzhnoye / NKAU (Ukraine)",
    "Ukraine",
    "Ukraine",
    "Ocean radar and weather remote sensing",
    "Okean was a Soviet/Ukrainian ocean-monitoring series with side-looking radar, later continued as Ukrainian Okean-O.",
    "ukraine-okean",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Okean" }],
  ),
  RESURS: wiki(
    "Roscosmos / NPO Mashinostroyeniya",
    "Russia",
    "Russia",
    "Earth observation (Resurs)",
    "Resurs is a Russian Earth-observation family. Resurs-DK 1 flew a high-resolution optical payload.",
    "russia-resurs",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Resurs-DK" }],
  ),
  ORBVIEW: wiki(
    "GeoEye (originally Orbital Imaging)",
    "Maxar (successor)",
    "United States",
    "Commercial ocean / Earth imaging",
    "OrbView-2 (SeaStar) carried SeaWiFS, NASA's ocean-color instrument, operated as a commercial remote-sensing satellite.",
    "geoeye-orbview",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/OrbView-2" }],
  ),
  SHIJIAN: wiki(
    "CNSA / CAST (Shijian technology series)",
    "China",
    "China",
    "Technology demonstration / science (Shijian)",
    "Shijian (SJ) is a Chinese designation for technology-experiment satellites. Individual missions differ widely.",
    "china-shijian",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Shijian" }],
  ),
  INTERCOSMOS: wiki(
    "Soviet Interkosmos programme",
    "Soviet Union (historical)",
    "Soviet Union / Russia",
    "International science (Interkosmos)",
    "Interkosmos was a Soviet programme that flew science payloads with partner countries. The satellites remain in catalog as historical objects.",
    "interkosmos",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Interkosmos" }],
  ),
  KORONAS: wiki(
    "Roscosmos / IZMIRAN",
    "Russia",
    "Russia",
    "Solar and heliophysics research",
    "Koronas-Foton was a Russian solar observatory studying the Sun in X-rays and gamma rays.",
    "russia-koronas",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Koronas-Foton" }],
  ),
  SERT: wiki(
    "NASA",
    "NASA",
    "United States",
    "Ion-thruster technology demonstration (historical)",
    "SERT 2 was a 1970 NASA mission that demonstrated ion electric propulsion for months in orbit.",
    "nasa-sert",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/SERT-2" }],
  ),
  USA: wiki(
    "United States (catalog designation)",
    "U.S. government (specific agency usually undisclosed)",
    "United States",
    "Classified / undisclosed payload (USA designation)",
    "Objects named USA n are U.S. catalog designations. Open sources rarely publish operator, owner, or purpose for these missions.",
    "usa-classified",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/USA_(satellite)" }],
  ),
  DEBRIS: wiki(
    "Not an active payload",
    "Original launch operator (see object name)",
    "Unknown",
    "Orbital debris — spent stage or fragment",
    "CelesTrak lists this as a rocket body (R/B) or debris (DEB). It is not a working satellite; it is leftover hardware still in orbit.",
    "catalog-debris",
    [{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Space_debris" }],
  ),
};

export function familyKeyFromName(name: string): string | undefined {
  const upper = name.toUpperCase();
  if (upper.includes("FREGAT")) return "FREGAT";
  if (upper.includes("R/B") || /\bDEB\b/.test(upper) || upper.endsWith("DEB")) return "DEBRIS";
  if (/\b(POISK|NAUKA|ZARYA|UNITY|HARMONY|TRANQUILITY|COLUMBUS|KIBO|CUPOLA|LEONARDO)\b/.test(upper)) {
    return "ISS";
  }
  if (/\b(TIANHE|WENTIAN|MENGTIAN)\b/.test(upper)) return "CSS";
  if (/\bSZ-\d+\s+MODULE\b/.test(upper)) return "CSS";
  const keys = [
    "COSMO-SKYMED",
    "SPACEMOBILE",
    "INTERCOSMOS",
    "TIANZHOU",
    "SHENZHOU",
    "PROGRESS",
    "CYGNUS",
    "SENTINEL",
    "CREW DRAGON",
    "ORBVIEW",
    "SEASTAR",
    "SHIJIAN",
    "KORONAS",
    "YAOGAN",
    "MIDORI",
    "ADEOS",
    "AJISAI",
    "RESURS",
    "OKEAN",
    "HUIYAN",
    "HXMT",
    "ACS3",
    "SERT",
    "ISIS",
    "USA",
    "DRAGON",
    "SOYUZ",
    "FREGAT",
    "SAOCOM",
    "SEASAT",
    "HELIOS",
    "ENVISAT",
    "COSMOS",
    "TERRA",
    "AQUA",
    "ALOS",
    "ERS",
    "CSS",
    "ISS",
  ];
  for (const key of keys) {
    if (upper.includes(key)) {
      if (key === "CREW DRAGON") return "CREW";
      if (key === "MIDORI" || key === "ADEOS") return "ADEOS";
      if (key === "SEASTAR") return "ORBVIEW";
      if (key === "HUIYAN") return "HXMT";
      return key;
    }
  }
  return constellationFromName(name);
}

export function wikiBriefFor(name: string): WikiBrief {
  const family = familyKeyFromName(name);
  if (family && WIKI[family]) return WIKI[family]!;
  const constellation = constellationFromName(name);
  if (constellation && WIKI[constellation]) return WIKI[constellation]!;
  return wiki(
    "See object name / national catalog",
    "Unknown",
    "Unknown",
    "Cataloged spacecraft in Earth orbit",
    `${name} is listed in the CelesTrak GP catalog. Operator and purpose are not always published for older or military objects — treat identity as catalog-only until a sourced dossier exists.`,
    "catalog-generic",
    [{ name: "CelesTrak", url: "https://celestrak.org/NORAD/elements/" }],
  );
}

/** Paint every visible object from the local wiki briefs. Cala can overwrite later. */
export function wikiOverlayFor(visible: VisibleSatellite[]): SatelliteOverlayMap {
  const dossiers: OverlayDossier[] = visible.map((sat) => {
    const brief = wikiBriefFor(sat.name);
    return {
      noradId: sat.noradId,
      evidenceState: "unknown",
      operator: brief.operator,
      ultimateParent: brief.ultimateParent,
      country: brief.country || null,
      purpose: brief.purpose,
      colorKey: brief.colorKey,
      seeded: true,
      blurb: brief.blurb,
      sources: brief.sources,
    };
  });
  return overlayFromDossiers(dossiers);
}
