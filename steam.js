/* Thermo Quest — saturated-water properties and problem engine.
   Loaded as a classic script; exposes window.THERMO. Instructors can edit the
   table or the generators here without touching the game. */
window.THERMO = (function () {
  // P kPa, Tsat C, vf, vg, uf, ug, hf, hfg, hg, sf, sg  (saturation, pressure entry)
  var SAT = [
    [10, 45.81, 0.001010, 14.6700, 191.79, 2437.2, 191.81, 2392.1, 2583.9, 0.6492, 8.1488],
    [20, 60.06, 0.001017, 7.64810, 251.40, 2456.0, 251.42, 2357.5, 2608.9, 0.8320, 7.9073],
    [50, 81.32, 0.001030, 3.24030, 340.49, 2483.2, 340.54, 2304.7, 2645.2, 1.0912, 7.5931],
    [75, 91.76, 0.001037, 2.21720, 384.36, 2496.1, 384.44, 2278.0, 2662.4, 1.2132, 7.4558],
    [100, 99.61, 0.001043, 1.69410, 417.40, 2505.6, 417.51, 2257.5, 2675.0, 1.3028, 7.3589],
    [150, 111.35, 0.001053, 1.15940, 466.97, 2519.2, 467.13, 2226.0, 2693.1, 1.4337, 7.2231],
    [200, 120.21, 0.001061, 0.88578, 504.50, 2529.1, 504.71, 2201.6, 2706.3, 1.5302, 7.1270],
    [300, 133.52, 0.001073, 0.60582, 561.11, 2543.2, 561.43, 2163.5, 2724.9, 1.6717, 6.9917],
    [400, 143.61, 0.001084, 0.46242, 604.22, 2553.1, 604.66, 2133.4, 2738.1, 1.7765, 6.8955],
    [500, 151.83, 0.001093, 0.37483, 639.54, 2560.7, 640.09, 2108.0, 2748.1, 1.8604, 6.8207],
    [600, 158.83, 0.001101, 0.31560, 669.72, 2566.8, 670.38, 2085.8, 2756.2, 1.9308, 6.7593],
    [800, 170.41, 0.001115, 0.24035, 720.20, 2575.5, 721.11, 2047.5, 2768.3, 2.0457, 6.6616],
    [1000, 179.88, 0.001127, 0.19436, 761.39, 2582.8, 762.51, 2014.6, 2777.1, 2.1381, 6.5850],
    [1500, 198.29, 0.001154, 0.13171, 842.82, 2593.4, 844.55, 1946.4, 2791.0, 2.3143, 6.4448],
    [2000, 212.38, 0.001177, 0.09959, 906.12, 2599.1, 908.47, 1889.8, 2798.3, 2.4467, 6.3390],
    [3000, 233.85, 0.001217, 0.06667, 1004.6, 2603.2, 1008.3, 1794.9, 2803.2, 2.6454, 6.1856],
    [5000, 263.94, 0.001286, 0.03945, 1148.1, 2597.0, 1154.5, 1639.7, 2794.2, 2.9207, 5.9737],
    [8000, 295.01, 0.001384, 0.02353, 1306.0, 2569.9, 1317.1, 1441.6, 2758.7, 3.2076, 5.7450],
    [10000, 311.00, 0.001452, 0.01803, 1393.3, 2544.7, 1407.8, 1317.1, 2724.7, 3.3603, 5.6141]
  ];
  var KEYS = ['P', 'T', 'vf', 'vg', 'uf', 'ug', 'hf', 'hfg', 'hg', 'sf', 'sg'];

  // Saturation states entered by temperature. T C, Psat kPa, vf, vg, hf, hfg, hg, sf, sg.
  // Internal energies are derived exactly from u = h - Pv, so only measured
  // quantities are stored here.
  var SATT_RAW = [
    [0.01, 0.6117, 0.0010002, 206.000, 0.001, 2500.9, 2500.9, 0.0000, 9.1556],
    [5, 0.8725, 0.0010001, 147.030, 21.02, 2489.1, 2510.1, 0.0763, 9.0249],
    [10, 1.2281, 0.0010003, 106.320, 42.02, 2477.2, 2519.2, 0.1511, 8.8998],
    [15, 1.7057, 0.0010009, 77.8850, 62.98, 2465.4, 2528.3, 0.2245, 8.7803],
    [20, 2.3392, 0.0010018, 57.7620, 83.91, 2453.5, 2537.4, 0.2965, 8.6661],
    [25, 3.1698, 0.0010030, 43.3400, 104.83, 2441.7, 2546.5, 0.3672, 8.5567],
    [30, 4.2469, 0.0010044, 32.8790, 125.74, 2429.8, 2555.6, 0.4368, 8.4520],
    [40, 7.3851, 0.0010079, 19.5150, 167.53, 2406.0, 2573.5, 0.5724, 8.2555],
    [50, 12.352, 0.0010121, 12.0260, 209.34, 2382.0, 2591.3, 0.7038, 8.0748],
    [60, 19.947, 0.0010171, 7.66700, 251.18, 2357.7, 2608.8, 0.8313, 7.9081],
    [70, 31.202, 0.0010228, 5.03960, 293.07, 2333.0, 2626.1, 0.9551, 7.7540],
    [80, 47.416, 0.0010291, 3.40530, 335.02, 2308.0, 2643.0, 1.0756, 7.6111],
    [90, 70.183, 0.0010360, 2.35930, 377.04, 2282.5, 2659.6, 1.1929, 7.4781],
    [100, 101.42, 0.0010435, 1.67200, 419.17, 2256.4, 2675.6, 1.3072, 7.3541],
    [110, 143.38, 0.0010516, 1.20940, 461.42, 2229.7, 2691.1, 1.4188, 7.2386],
    [120, 198.67, 0.0010603, 0.891330, 503.81, 2202.1, 2705.9, 1.5279, 7.1296],
    [140, 361.53, 0.0010797, 0.508500, 589.16, 2144.3, 2733.5, 1.7392, 6.9291],
    [160, 618.23, 0.0011019, 0.306800, 675.47, 2082.0, 2757.5, 1.9426, 6.7491],
    [180, 1002.8, 0.0011274, 0.194050, 763.05, 2014.2, 2777.2, 2.1392, 6.5850],
    [200, 1554.9, 0.0011565, 0.127210, 852.26, 1939.8, 2792.0, 2.3305, 6.4302],
    [220, 2319.6, 0.0011900, 0.0860940, 943.58, 1857.4, 2801.0, 2.5177, 6.2841],
    [240, 3346.9, 0.0012291, 0.0596540, 1037.6, 1765.4, 2803.0, 2.7020, 6.1423],
    [260, 4692.3, 0.0012755, 0.0421750, 1135.0, 1661.6, 2796.6, 2.8848, 6.0014],
    [280, 6416.6, 0.0013321, 0.0301530, 1236.9, 1543.0, 2779.9, 3.0685, 5.8580],
    [300, 8587.9, 0.0014036, 0.0216490, 1345.0, 1404.6, 2749.6, 3.2552, 5.7059],
    [320, 11284, 0.0014988, 0.0154510, 1462.2, 1238.4, 2700.6, 3.4494, 5.5372],
    [340, 14601, 0.0016379, 0.0108010, 1594.5, 1027.3, 2621.8, 3.6601, 5.3355],
    [360, 18666, 0.0018950, 0.00694940, 1761.7, 720.50, 2482.2, 3.9165, 5.0545],
    [373.95, 22064, 0.0031060, 0.00310600, 2084.3, 0.0, 2084.3, 4.4070, 4.4070]
  ];
  // Rebuilt into the same column order as SAT, with u = h - Pv.
  var SATT = SATT_RAW.map(function (r) {
    var T = r[0], P = r[1], vf = r[2], vg = r[3], hf = r[4], hfg = r[5], hg = r[6];
    return [P, T, vf, vg, hf - P * vf, hg - P * vg, hf, hfg, hg, r[7], r[8]];
  });

  // Generalized compressibility from Redlich-Kwong in reduced form. Newton on
  // Z^3 - Z^2 + (A - B - B^2) Z - A B = 0, started from the vapour root.
  function zRK(Tr, Pr) {
    if (Tr <= 0 || Pr < 0) return NaN;
    var A = 0.42748 * Pr / Math.pow(Tr, 2.5), B = 0.08664 * Pr / Tr;
    var c1 = A - B - B * B, c0 = -A * B, Z = 1;
    for (var i = 0; i < 60; i++) {
      var f = Z * Z * Z - Z * Z + c1 * Z + c0;
      var d = 3 * Z * Z - 2 * Z + c1;
      if (Math.abs(d) < 1e-12) break;
      var next = Z - f / d;
      if (next < 1e-4) next = 1e-4;
      if (Math.abs(next - Z) < 1e-10) { Z = next; break; }
      Z = next;
    }
    return Z;
  }

  // Critical constants and gas constants (measured values).
  var GASES = [
    { name: 'Air', M: 28.97, R: 0.2870, Tcr: 132.5, Pcr: 3770 },
    { name: 'Water (H2O)', M: 18.015, R: 0.4615, Tcr: 647.1, Pcr: 22060 },
    { name: 'Nitrogen (N2)', M: 28.013, R: 0.2968, Tcr: 126.2, Pcr: 3390 },
    { name: 'Oxygen (O2)', M: 31.999, R: 0.2598, Tcr: 154.8, Pcr: 5080 },
    { name: 'Carbon dioxide (CO2)', M: 44.01, R: 0.1889, Tcr: 304.2, Pcr: 7390 },
    { name: 'Methane (CH4)', M: 16.043, R: 0.5182, Tcr: 191.1, Pcr: 4640 },
    { name: 'Refrigerant-134a', M: 102.03, R: 0.08149, Tcr: 374.2, Pcr: 4059 },
    { name: 'Helium', M: 4.003, R: 2.0769, Tcr: 5.3, Pcr: 228 },
    { name: 'Hydrogen (H2)', M: 2.016, R: 4.1240, Tcr: 33.3, Pcr: 1300 },
    { name: 'Ammonia (NH3)', M: 17.03, R: 0.4882, Tcr: 405.5, Pcr: 11280 }
  ];

  // Table A-6, superheated water: one block per pressure. Rows are
  // [T C, v m3/kg, u kJ/kg, h kJ/kg, s kJ/kg.K], first row the saturated
  // vapour state at that pressure. A working excerpt, not the whole table.
  var SUP = [
    { P: 10, Tsat: 45.81, rows: [
      [45.81, 14.670, 2437.2, 2583.9, 8.1488], [50, 14.867, 2443.3, 2592.0, 8.1741],
      [100, 17.196, 2515.5, 2687.5, 8.4489], [150, 19.513, 2587.9, 2783.0, 8.6893],
      [200, 21.826, 2661.4, 2879.6, 8.9049], [250, 24.136, 2736.1, 2977.5, 9.1015],
      [300, 26.446, 2812.3, 3076.7, 9.2827], [400, 31.063, 2969.3, 3280.0, 9.6094],
      [500, 35.680, 3132.9, 3489.7, 9.8998]] },
    { P: 50, Tsat: 81.32, rows: [
      [81.32, 3.2403, 2483.2, 2645.2, 7.5931], [100, 3.4187, 2511.5, 2682.4, 7.6953],
      [150, 3.8897, 2585.7, 2780.2, 7.9413], [200, 4.3562, 2660.0, 2877.8, 8.1592],
      [250, 4.8206, 2735.1, 2976.2, 8.3568], [300, 5.2841, 2811.6, 3075.8, 8.5387],
      [400, 6.2094, 2968.9, 3279.3, 8.8659], [500, 7.1338, 3132.6, 3489.3, 9.1566]] },
    { P: 100, Tsat: 99.61, rows: [
      [99.61, 1.6941, 2505.6, 2675.0, 7.3589], [100, 1.6959, 2506.2, 2675.8, 7.3611],
      [150, 1.9367, 2582.9, 2776.6, 7.6148], [200, 2.1724, 2658.2, 2875.5, 7.8356],
      [250, 2.4062, 2733.9, 2974.5, 8.0346], [300, 2.6389, 2810.7, 3074.5, 8.2172],
      [400, 3.1027, 2968.3, 3278.6, 8.5452], [500, 3.5655, 3132.2, 3488.7, 8.8362]] },
    { P: 200, Tsat: 120.21, rows: [
      [120.21, 0.88578, 2529.1, 2706.3, 7.1270], [150, 0.95986, 2577.1, 2769.1, 7.2810],
      [200, 1.08049, 2654.6, 2870.7, 7.5081], [250, 1.19890, 2731.4, 2971.2, 7.7100],
      [300, 1.31623, 2808.8, 3072.1, 7.8941], [400, 1.54934, 2967.2, 3277.0, 8.2236],
      [500, 1.78142, 3131.4, 3487.7, 8.5153]] },
    { P: 400, Tsat: 143.61, rows: [
      [143.61, 0.46242, 2553.1, 2738.1, 6.8955], [150, 0.47088, 2564.4, 2752.8, 6.9306],
      [200, 0.53434, 2647.2, 2860.9, 7.1723], [250, 0.59520, 2726.4, 2964.5, 7.3804],
      [300, 0.65489, 2805.1, 3067.1, 7.5677], [400, 0.77265, 2964.9, 3273.9, 7.9003],
      [500, 0.88936, 3129.8, 3485.5, 8.1933]] },
    { P: 1000, Tsat: 179.88, rows: [
      [179.88, 0.19437, 2582.8, 2777.1, 6.5850], [200, 0.20602, 2622.3, 2828.3, 6.6956],
      [250, 0.23275, 2710.4, 2943.1, 6.9265], [300, 0.25799, 2793.7, 3051.6, 7.1246],
      [350, 0.28250, 2875.7, 3158.2, 7.3029], [400, 0.30661, 2957.9, 3264.5, 7.4670],
      [500, 0.35411, 3125.0, 3479.1, 7.7642]] },
    { P: 2000, Tsat: 212.38, rows: [
      [212.38, 0.099587, 2600.3, 2799.5, 6.3390], [250, 0.11144, 2680.2, 2903.0, 6.5475],
      [300, 0.12551, 2773.2, 3024.2, 6.7684], [350, 0.13860, 2860.5, 3137.7, 6.9583],
      [400, 0.15122, 2945.9, 3248.4, 7.1292], [500, 0.17568, 3116.9, 3468.3, 7.4337]] },
    { P: 3000, Tsat: 233.85, rows: [
      [233.85, 0.066700, 2603.2, 2803.2, 6.1856], [250, 0.070580, 2644.7, 2856.5, 6.2893],
      [300, 0.081175, 2750.8, 2994.3, 6.5412], [350, 0.090555, 2844.4, 3116.1, 6.7450],
      [400, 0.099352, 2933.6, 3231.7, 6.9235], [500, 0.116430, 3110.4, 3459.6, 7.2338]] },
    { P: 5000, Tsat: 263.94, rows: [
      [263.94, 0.039448, 2596.9, 2794.2, 5.9737], [300, 0.045347, 2698.0, 2924.5, 6.2119],
      [350, 0.051932, 2809.5, 3069.3, 6.4530], [400, 0.057804, 2907.5, 3196.7, 6.6459],
      [500, 0.068583, 3092.4, 3435.3, 6.9781]] },
    { P: 10000, Tsat: 311.00, rows: [
      [311.00, 0.018028, 2545.2, 2725.5, 5.6159], [350, 0.022415, 2699.6, 2923.7, 5.9459],
      [400, 0.026436, 2833.1, 3097.4, 6.2141], [450, 0.029782, 2944.5, 3242.3, 6.4219],
      [500, 0.032811, 3047.0, 3375.1, 6.5995]] }
  ];
  // Table A-7, compressed liquid water. Same row shape; the last row of each
  // block is the saturated liquid state at that pressure.
  var CPL = [
    { P: 5000, Tsat: 263.94, rows: [
      [0, 0.0009977, 0.04, 5.03, 0.0001], [20, 0.0009996, 83.61, 88.61, 0.2954],
      [40, 0.0010057, 166.92, 171.95, 0.5705], [60, 0.0010149, 250.29, 255.36, 0.8287],
      [80, 0.0010267, 333.82, 338.96, 1.0723], [100, 0.0010410, 417.65, 422.85, 1.3034],
      [140, 0.0010768, 586.76, 592.15, 1.7345], [180, 0.0011240, 759.63, 765.24, 2.1341],
      [220, 0.0011866, 940.87, 946.80, 2.5175], [260, 0.0012751, 1136.1, 1142.5, 2.8963]] },
    { P: 10000, Tsat: 311.00, rows: [
      [0, 0.0009952, 0.12, 10.07, 0.0003], [20, 0.0009973, 83.31, 93.28, 0.2942],
      [40, 0.0010035, 166.33, 176.37, 0.5685], [60, 0.0010127, 249.43, 259.55, 0.8260],
      [80, 0.0010244, 332.69, 342.94, 1.0691], [100, 0.0010385, 416.23, 426.62, 1.2996],
      [140, 0.0010737, 584.79, 595.52, 1.7293], [180, 0.0011199, 756.65, 767.85, 2.1271],
      [220, 0.0011805, 936.15, 947.96, 2.5083], [260, 0.0012645, 1128.4, 1141.0, 2.8829],
      [300, 0.0013980, 1329.4, 1343.3, 3.2488]] },
    { P: 20000, Tsat: 365.75, rows: [
      [0, 0.0009904, 0.25, 20.06, 0.0006], [20, 0.0009929, 82.71, 102.57, 0.2921],
      [40, 0.0009993, 165.15, 185.14, 0.5646], [60, 0.0010084, 247.66, 267.83, 0.8208],
      [80, 0.0010199, 330.38, 350.78, 1.0627], [100, 0.0010337, 413.37, 434.06, 1.2920],
      [140, 0.0010678, 580.90, 602.31, 1.7194], [180, 0.0011120, 750.95, 773.20, 2.1153],
      [220, 0.0011693, 927.01, 950.39, 2.4914], [260, 0.0012462, 1112.9, 1137.8, 2.8578],
      [300, 0.0013611, 1306.1, 1333.3, 3.2071]] }
  ];
  // Interpolate one block of A-6 / A-7 at a temperature, returning the two
  // bracketing row indices so the reader can highlight exactly what it used.
  function blockAt(block, Tc) {
    var rows = block.rows;
    if (Tc <= rows[0][0]) return { lo: 0, hi: 0, f: 0, row: rows[0].slice() };
    for (var i = 1; i < rows.length; i++) {
      if (Tc <= rows[i][0]) {
        var a = rows[i - 1], b = rows[i], f = (Tc - a[0]) / (b[0] - a[0]);
        var out = [Tc];
        for (var j = 1; j < a.length; j++) out.push(a[j] + f * (b[j] - a[j]));
        return { lo: i - 1, hi: i, f: f, row: out };
      }
    }
    var last = rows.length - 1;
    return { lo: last, hi: last, f: 0, row: rows[last].slice() };
  }
  // Bracketing indices for the saturation tables, for the same highlight.
  function bracket(rows, col, val) {
    if (val <= rows[0][col]) return { lo: 0, hi: 0, f: 0 };
    for (var i = 1; i < rows.length; i++) {
      if (val <= rows[i][col]) {
        return { lo: i - 1, hi: i, f: (val - rows[i - 1][col]) / (rows[i][col] - rows[i - 1][col]) };
      }
    }
    var last = rows.length - 1;
    return { lo: last, hi: last, f: 0 };
  }

  // Unit conversions and physical constants, grouped for display.
  var CONV_GROUPS = [
    { g: 'LENGTH', rows: [['1 m', '100 cm = 1000 mm'], ['1 m', '39.370 in = 3.2808 ft'],
      ['1 ft', '12 in = 0.3048 m (exact)'], ['1 in', '2.54 cm (exact)'], ['1 mile', '5280 ft = 1.6093 km']] },
    { g: 'MASS', rows: [['1 kg', '1000 g = 2.2046226 lbm'], ['1 lbm', '0.45359237 kg (exact)'],
      ['1 slug', '32.174 lbm = 14.5939 kg'], ['1 metric ton', '1000 kg'], ['1 short ton', '2000 lbm = 907.185 kg']] },
    { g: 'FORCE', rows: [['1 N', '1 kg.m/s2 = 0.22481 lbf'], ['1 lbf', '32.174 lbm.ft/s2 = 4.44822 N'],
      ['1 kgf', '9.80665 N']] },
    { g: 'PRESSURE', rows: [['1 Pa', '1 N/m2'], ['1 kPa', '0.14504 psia = 20.886 lbf/ft2'],
      ['1 psi', '144 lbf/ft2 = 6.894757 kPa'], ['1 atm', '101.325 kPa = 1.01325 bar = 14.696 psia'],
      ['1 atm', '760 mm Hg (0 C) = 29.9213 in Hg (32 F)'], ['1 in Hg', '3.387 kPa'], ['1 mm Hg', '0.1333 kPa']] },
    { g: 'VOLUME', rows: [['1 m3', '1000 L = 10^6 cm3'], ['1 m3', '35.315 ft3 = 264.17 gal (U.S.)'],
      ['1 gal (U.S.)', '231 in3 = 3.7854 L'], ['1 ft3', '0.0283168 m3']] },
    { g: 'SPECIFIC VOLUME', rows: [['1 m3/kg', '1000 L/kg = 16.02 ft3/lbm'], ['1 ft3/lbm', '0.062428 m3/kg']] },
    { g: 'DENSITY', rows: [['1 kg/m3', '0.062428 lbm/ft3'], ['1 g/cm3', '1000 kg/m3 = 62.428 lbm/ft3']] },
    { g: 'ENERGY, WORK, HEAT', rows: [['1 kJ', '1000 N.m = 1 kPa.m3'], ['1 kJ', '0.94782 Btu'],
      ['1 Btu', '1.055056 kJ'], ['1 kWh', '3600 kJ = 3412.14 Btu'], ['1 kJ/kg', '1000 m2/s2 = 0.430 Btu/lbm'],
      ['1 Btu/lbm', '2.326 kJ/kg (exact)'], ['1 cal (IT)', '4.1868 J']] },
    { g: 'POWER', rows: [['1 W', '1 J/s'], ['1 kW', '3412.14 Btu/h = 1.341 hp'],
      ['1 hp (mech.)', '550 lbf.ft/s = 0.74570 kW'], ['1 ton of refrig.', '200 Btu/min']] },
    { g: 'SPECIFIC HEAT', rows: [['1 kJ/kg.C', '1 kJ/kg.K = 1 J/g.C'], ['1 kJ/kg.C', '0.23885 Btu/lbm.F'],
      ['1 Btu/lbm.F', '4.1868 kJ/kg.C']] },
    { g: 'TEMPERATURE', rows: [['T(K)', 'T(C) + 273.15'], ['T(R)', 'T(F) + 459.67 = 1.8 T(K)'],
      ['T(F)', '1.8 T(C) + 32'], ['dT(K)', 'dT(C);  dT(F) = dT(R) = 1.8 dT(K)']] },
    { g: 'VELOCITY & FLOW', rows: [['1 m/s', '3.2808 ft/s = 3.60 km/h = 2.237 mi/h'],
      ['1 m3/s', '35.315 ft3/s = 15,850 gal/min'], ['1 m3/s', '2118.9 ft3/min (cfm)']] }
  ];
  var CONSTANTS = [
    ['Universal gas constant Ru', '8.31447 kJ/kmol.K = 1.9858 Btu/lbmol.R'],
    ['', '8.31447 kPa.m3/kmol.K = 10.73 psia.ft3/lbmol.R'],
    ['Standard gravity g', '9.80665 m/s2 = 32.174 ft/s2'],
    ['Standard atmosphere', '101.325 kPa = 14.696 psia = 760 mm Hg (0 C)'],
    ['Stefan-Boltzmann sigma', '5.6704e-8 W/m2.K4'],
    ['Boltzmann constant k', '1.380650e-23 J/K'],
    ['Speed of light c0', '2.9979e8 m/s'],
    ['Speed of sound, air 0 C 1 atm', '331.36 m/s = 1087 ft/s'],
    ['Heat of fusion of water, 1 atm', '333.7 kJ/kg = 143.5 Btu/lbm'],
    ['Enthalpy of vaporization, 1 atm', '2256.5 kJ/kg = 970.12 Btu/lbm']
  ];

  function rowObj(r) {
    var o = {};
    for (var i = 0; i < KEYS.length; i++) o[KEYS[i]] = r[i];
    return o;
  }
  function lerpRows(a, b, t) {
    var o = {};
    for (var i = 0; i < KEYS.length; i++) o[KEYS[i]] = a[i] + (b[i] - a[i]) * t;
    return o;
  }
  // Linear interpolation inside one table: SAT (by pressure) or SATT (by temperature).
  function lookupIn(rows, value, col) {
    if (value <= rows[0][col]) return rowObj(rows[0]);
    if (value >= rows[rows.length - 1][col]) return rowObj(rows[rows.length - 1]);
    for (var i = 0; i < rows.length - 1; i++) {
      var a = rows[i], b = rows[i + 1];
      if (value >= a[col] && value <= b[col]) return lerpRows(a, b, (value - a[col]) / (b[col] - a[col]));
    }
    return rowObj(rows[rows.length - 1]);
  }
  function lookup(value, col) { return lookupIn(SAT, value, col); }

  // y = y_f + x (y_g - y_f)
  function mix(s, x) {
    return {
      v: s.vf + x * (s.vg - s.vf),
      u: s.uf + x * (s.ug - s.uf),
      h: s.hf + x * s.hfg,
      s: s.sf + x * (s.sg - s.sf)
    };
  }
  function quality(s, prop, value) {
    var f = { v: s.vf, u: s.uf, h: s.hf, s: s.sf }[prop];
    var g = { v: s.vg, u: s.ug, h: s.hg, s: s.sg }[prop];
    var x = (value - f) / (g - f);
    return { x: x, f: f, g: g, inDome: x >= 0 && x <= 1 };
  }
  // Fraction of tank HEIGHT filled with liquid for a mixture of quality x.
  function level(s, x) {
    var vt = s.vf + x * (s.vg - s.vf);
    return ((1 - x) * s.vf) / vt;
  }

  var CONV = {
    P: { f: 0.145038, si: 'kPa', en: 'psia', d: [0, 1] },
    v: { f: 16.0185, si: 'm3/kg', en: 'ft3/lbm', d: [5, 3] },
    u: { f: 0.429923, si: 'kJ/kg', en: 'Btu/lbm', d: [1, 1] },
    h: { f: 0.429923, si: 'kJ/kg', en: 'Btu/lbm', d: [1, 1] },
    s: { f: 0.238846, si: 'kJ/kg.K', en: 'Btu/lbm.R', d: [4, 4] },
    m: { f: 2.20462, si: 'kg', en: 'lbm', d: [1, 1] },
    V: { f: 35.3147, si: 'm3', en: 'ft3', d: [4, 3] },
    U: { f: 0.947817, si: 'kJ', en: 'Btu', d: [1, 1] },
    S: { f: 0.526565, si: 'kJ/K', en: 'Btu/R', d: [4, 4] }
  };
  var TOTAL_OF = { v: 'V', u: 'U', h: 'U', s: 'S' };

  function conv(kind, si, english) {
    if (kind === 'T') return english ? si * 1.8 + 32 : si;
    if (kind === 'x') return si;
    return english ? si * CONV[kind].f : si;
  }
  function toSI(kind, val, english) {
    if (kind === 'T') return english ? (val - 32) / 1.8 : val;
    if (kind === 'x') return val;
    return english ? val / CONV[kind].f : val;
  }
  function unit(kind, english) {
    if (kind === 'T') return english ? 'F' : 'C';
    if (kind === 'x') return '-';
    return english ? CONV[kind].en : CONV[kind].si;
  }
  // Printed-table formatting. The gauge formatter above rounds for readability,
  // which collapses the low-pressure and liquid-volume rows into duplicates —
  // exactly the rows a condenser or pump-work calculation needs. Table cells
  // instead keep four significant figures for pressure and six decimals for
  // specific volume, the way the printed tables do.
  function showTbl(kind, si, english) {
    if (si == null || isNaN(si)) return '--';
    var v = conv(kind, si, english);
    if (kind === 'P') {
      if (v === 0) return '0';
      var mag = Math.floor(Math.log(Math.abs(v)) / Math.LN10);
      var dp = Math.max(0, Math.min(6, 3 - mag));
      return v.toFixed(dp);
    }
    if (kind === 'v') return v.toFixed(6);
    if (kind === 'T') return v.toFixed(Math.abs(v) < 1 ? 2 : 1);
    return show(kind, si, english);
  }
  function show(kind, si, english) {
    if (si == null || isNaN(si)) return '--';
    var v = conv(kind, si, english);
    var dp = kind === 'T' ? 1 : (kind === 'x' ? 4 : CONV[kind].d[english ? 1 : 0]);
    if (Math.abs(v) >= 10000) return v.toFixed(0);
    return v.toFixed(dp);
  }

  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  var PRESSURES = [100, 150, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000];
  var PROPS = ['v', 'u', 'h', 's'];
  var VESSELS = ['rigid tank', 'piston-cylinder device', 'closed feedwater heater', 'flash chamber'];
  var PROP_NAME = { v: 'specific volume', u: 'internal energy', h: 'enthalpy', s: 'entropy' };

  function makeProblem(seed) {
    var r = rng(seed);
    var P = PRESSURES[Math.floor(r() * PRESSURES.length)];
    var prop = PROPS[Math.floor(r() * PROPS.length)];
    var ask = PROPS[Math.floor(r() * PROPS.length)];
    var guard = 0;
    while (ask === prop && guard++ < 8) ask = PROPS[Math.floor(r() * PROPS.length)];
    var x = Math.round((0.15 + r() * 0.7) * 100) / 100;
    var mass = [1, 2, 2.5, 4, 5][Math.floor(r() * 5)];
    var s = lookup(P, 0);
    var m = mix(s, x);
    return {
      seed: seed, P: P, prop: prop, given: m[prop], x: x, ask: ask,
      vessel: VESSELS[Math.floor(r() * VESSELS.length)], mass: mass, sat: s,
      propName: PROP_NAME[prop], askName: PROP_NAME[ask],
      totalKind: TOTAL_OF[ask],
      answers: { T: s.T, x: x, ask: m[ask], total: m[ask] * mass }
    };
  }

  // 2% relative tolerance is what a thermo grader would allow off table interpolation.
  function grade(entry, truth, tol) {
    if (entry === '' || entry == null) return null;
    var g = Number(entry);
    if (isNaN(g)) return null;
    var span = Math.abs(truth) < 1e-9 ? 1 : Math.abs(truth);
    return Math.abs(g - truth) / span <= (tol == null ? 0.02 : tol);
  }

  return {
    SAT: SAT, SATT: SATT, KEYS: KEYS, GASES: GASES, CONV_GROUPS: CONV_GROUPS, CONSTANTS: CONSTANTS, zRK: zRK,
    satP: function (P) { return lookup(P, 0); }, satT: function (T) { return lookupIn(SATT, T, 1); },
    mix: mix, quality: quality, level: level, PRESSURES: PRESSURES, PROPS: PROPS,
    PROP_NAME: PROP_NAME, TOTAL_OF: TOTAL_OF,
    conv: conv, toSI: toSI, unit: unit, show: show, showTbl: showTbl,
    SUP: SUP, CPL: CPL, blockAt: blockAt, bracket: bracket,
    makeProblem: makeProblem, grade: grade
  };
})();
