/**
 * NAMHSA Regional Boundaries
 * Source: https://namhsa.org/ (11 official regions)
 *
 * Partnership language: "Find local shows and groups in your NAMHSA region"
 */
export const NAMHSA_REGIONS = [
    { key: "northeast", label: "Northeast", states: "CT, MA, ME, NH, RI, VT" },
    { key: "mid_atlantic", label: "Mid-Atlantic", states: "DC, DE, MD, NJ, NY, PA" },
    { key: "southeast", label: "Southeast", states: "AL, FL, GA, KY, MS, NC, SC, TN, VA, WV" },
    { key: "great_lakes", label: "Great Lakes", states: "IL, IN, MI, OH, WI" },
    { key: "south_central", label: "South Central", states: "AR, LA, MO, OK, TX" },
    { key: "north_central", label: "North Central", states: "IA, KS, MN, NE, ND, SD" },
    { key: "mountain", label: "Mountain", states: "CO, MT, NM, UT, WY" },
    { key: "pacific_northwest", label: "Pacific Northwest", states: "AK, ID, OR, WA" },
    { key: "pacific_southwest", label: "Pacific Southwest", states: "AZ, CA, HI, NV" },
    { key: "canada_east", label: "Canada East", states: "ON, QC, Atlantic Provinces" },
    { key: "canada_west", label: "Canada West", states: "AB, BC, MB, SK" },
] as const;

export type NamhsaRegion = typeof NAMHSA_REGIONS[number]["key"];

export const SANCTIONING_BODIES = [
    { key: "namhsa", label: "NAMHSA" },
    { key: "other", label: "Other" },
] as const;
