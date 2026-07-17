/* ============================================================
   Kahawa Smart — Disease reference data (single source of truth)

   This project uses plain global <script> tags, not ES modules, so
   there is no `export`. The data is exposed as `window.DISEASES` and
   read by app.js (which is loaded AFTER this file). Edit content here
   only — never hardcode it into templates.
============================================================ */
(function () {
  const DISEASES = {
    coffee_leaf_rust: {
      name: "Coffee Leaf Rust",
      scientificName: "Hemileia vastatrix",
      localName: "Kutu ya Majani",
      symptoms: [
        "Small pale-yellow spots appear on the upper leaf surface, often near the leaf edges.",
        "On the UNDERSIDE of the leaf, these spots carry a bright orange-yellow powdery dust (the fungal spores). This is the single most reliable sign.",
        "Spots enlarge and merge into irregular patches, and the centre turns brown and dries out as the tissue dies.",
        "Affected leaves drop early, starting on the lower and inner branches and moving upward.",
        "Heavy defoliation leaves bare branches ('dieback'), which reduces the next season's yield."
      ],
      favourableConditions: [
        "Warm, humid weather (roughly 21–25 °C) with prolonged leaf wetness.",
        "Rainy season and heavy dew; rain splash and wind spread the spores.",
        "Dense, unpruned canopies with poor air circulation.",
        "Trees already stressed by a heavy crop load or low soil nutrition."
      ],
      lookalikes: [
        "Brown eye spot — round brown spots with a grey centre and a yellow halo, but NO orange powder underneath.",
        "Nutrient deficiency — yellowing is uniform or between the veins, not spotty, and never powdery."
      ]
    }
  };

  window.DISEASES = DISEASES;
})();
