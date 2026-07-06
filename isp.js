/**
 * Bangladesh ISP Mapping
 * Shamim IPTV Gateway v2
 */

export const ISP = {

  // MIR
  138004: "mir",

  // Digi Jadoo
  131464: "jadoo",

  // AmberIT
  23956: "amberit",

  // Grameenphone
  17839: "gp",

  // Robi
  17623: "robi",

  // Banglalink
  24389: "banglalink",

  // Airtel (Robi Network)
  38368: "airtel",

  // Teletalk
  132137: "teletalk"

};


// Backup ISP Name Detect

export function detectISP(name = "") {

  name = name.toLowerCase();

  if (name.includes("mir"))
    return "mir";

  if (name.includes("amber"))
    return "amberit";

  if (name.includes("jadoo"))
    return "jadoo";

  if (name.includes("grameen"))
    return "gp";

  if (name.includes("robi"))
    return "robi";

  if (name.includes("airtel"))
    return "airtel";

  if (name.includes("banglalink"))
    return "banglalink";

  if (name.includes("teletalk"))
    return "teletalk";

  return "default";

}
