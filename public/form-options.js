/**
 * Dropdown source data: countries, US states + zips, Canada provinces + zips,
 * a few international regions/zips, and industry labels.
 * Loaded before app.js; exposed as window.scraperFormData.
 */
(function () {
  /** US: state code -> full name + sample ZIPs (Maps search) */
  const US_STATES = {
    AL: { name: 'Alabama', zips: ['35201', '35203', '36104', '35401', '35801', '36602'] },
    AK: { name: 'Alaska', zips: ['99501', '99503', '99701', '99801', '99901'] },
    AZ: { name: 'Arizona', zips: ['85001', '85003', '85701', '85201', '86301', '85621'] },
    AR: { name: 'Arkansas', zips: ['72201', '72701', '72901', '71601', '72401'] },
    CA: { name: 'California', zips: ['90001', '90210', '94102', '92101', '95814', '94607', '92626'] },
    CO: { name: 'Colorado', zips: ['80202', '80903', '80501', '80301', '81401'] },
    CT: { name: 'Connecticut', zips: ['06103', '06810', '06510', '06902', '06702'] },
    DE: { name: 'Delaware', zips: ['19901', '19702', '19801'] },
    DC: { name: 'District of Columbia', zips: ['20001', '20002', '20005', '20036'] },
    FL: { name: 'Florida', zips: ['33101', '32801', '33602', '32202', '33401', '34102'] },
    GA: { name: 'Georgia', zips: ['30303', '31401', '31901', '30601', '30901'] },
    HI: { name: 'Hawaii', zips: ['96813', '96815', '96720', '96740'] },
    ID: { name: 'Idaho', zips: ['83702', '83401', '83814', '83301'] },
    IL: { name: 'Illinois', zips: ['60601', '62701', '61602', '61101', '61801'] },
    IN: { name: 'Indiana', zips: ['46204', '46802', '47905', '47401'] },
    IA: { name: 'Iowa', zips: ['50309', '52401', '52801', '52240'] },
    KS: { name: 'Kansas', zips: ['67202', '66603', '66101', '67801'] },
    KY: { name: 'Kentucky', zips: ['40202', '40507', '42101', '41011'] },
    LA: { name: 'Louisiana', zips: ['70112', '70802', '71101', '70501'] },
    ME: { name: 'Maine', zips: ['04101', '04401', '04330'] },
    MD: { name: 'Maryland', zips: ['21201', '20814', '21401', '21701'] },
    MA: { name: 'Massachusetts', zips: ['02108', '02210', '01608', '01103'] },
    MI: { name: 'Michigan', zips: ['48226', '49503', '48933', '49855'] },
    MN: { name: 'Minnesota', zips: ['55401', '55102', '55802', '55902'] },
    MS: { name: 'Mississippi', zips: ['39201', '39705', '39501'] },
    MO: { name: 'Missouri', zips: ['63101', '64105', '65806', '65201'] },
    MT: { name: 'Montana', zips: ['59101', '59801', '59715'] },
    NE: { name: 'Nebraska', zips: ['68102', '68508', '69101'] },
    NV: { name: 'Nevada', zips: ['89101', '89501', '89521', '89801'] },
    NH: { name: 'New Hampshire', zips: ['03101', '03801', '03561'] },
    NJ: { name: 'New Jersey', zips: ['07102', '08540', '08226', '07030'] },
    NM: { name: 'New Mexico', zips: ['87102', '87501', '88201'] },
    NY: { name: 'New York', zips: ['10001', '11201', '14201', '12207', '14604'] },
    NC: { name: 'North Carolina', zips: ['27601', '28202', '27101', '28801'] },
    ND: { name: 'North Dakota', zips: ['58102', '58501', '58801'] },
    OH: { name: 'Ohio', zips: ['43215', '44114', '45202', '43201', '45402'] },
    OK: { name: 'Oklahoma', zips: ['73102', '74103', '73008'] },
    OR: { name: 'Oregon', zips: ['97201', '97401', '97301', '97701'] },
    PA: { name: 'Pennsylvania', zips: ['19107', '15222', '17101', '18101'] },
    RI: { name: 'Rhode Island', zips: ['02903', '02840', '02906'] },
    SC: { name: 'South Carolina', zips: ['29201', '29401', '29601', '29901'] },
    SD: { name: 'South Dakota', zips: ['57104', '57701', '57401'] },
    TN: { name: 'Tennessee', zips: ['37219', '38103', '37402', '37902'] },
    TX: { name: 'Texas', zips: ['75201', '77002', '78701', '78205', '79901', '79401'] },
    UT: { name: 'Utah', zips: ['84111', '84321', '84720'] },
    VT: { name: 'Vermont', zips: ['05401', '05733', '05101'] },
    VA: { name: 'Virginia', zips: ['23219', '23451', '23666', '22314'] },
    WA: { name: 'Washington', zips: ['98101', '99201', '98502', '99301'] },
    WV: { name: 'West Virginia', zips: ['25301', '26505', '25801'] },
    WI: { name: 'Wisconsin', zips: ['53202', '53703', '54301', '54901'] },
    WY: { name: 'Wyoming', zips: ['82001', '82601', '82901'] },
  };

  /** Canada: province code -> name + sample postal codes (spacing optional for search) */
  const CA_PROVINCES = {
    AB: { name: 'Alberta', zips: ['T5J 0A1', 'T2P 0K3', 'T3B 0E2'] },
    BC: { name: 'British Columbia', zips: ['V6B 1A1', 'V8W 1N6', 'V5K 0A1'] },
    MB: { name: 'Manitoba', zips: ['R3C 0B9', 'R2H 0H2'] },
    NB: { name: 'New Brunswick', zips: ['E3B 1A1', 'E2L 1A1'] },
    NL: { name: 'Newfoundland and Labrador', zips: ['A1C 1B9', 'A1A 1A1'] },
    NS: { name: 'Nova Scotia', zips: ['B3H 1A1', 'B2Y 1A1'] },
    NT: { name: 'Northwest Territories', zips: ['X1A 2P6'] },
    NU: { name: 'Nunavut', zips: ['X0A 0H0'] },
    ON: { name: 'Ontario', zips: ['M5H 2N2', 'K1A 0A6', 'L6T 0A1'] },
    PE: { name: 'Prince Edward Island', zips: ['C1A 4P3'] },
    QC: { name: 'Quebec', zips: ['H2Y 1C6', 'G1R 4M5'] },
    SK: { name: 'Saskatchewan', zips: ['S4P 3Y2', 'S7K 3J8'] },
    YT: { name: 'Yukon', zips: ['Y1A 2A6'] },
  };

  /**
   * India: all states + union territories with sample PIN codes (major city/capital).
   * Keys are ISO 3166-2 style abbreviations for internal use only.
   */
  const INDIA_STATES = {
    AP: { name: 'Andhra Pradesh', zips: ['530016', '520001', '517501'] },
    AR: { name: 'Arunachal Pradesh', zips: ['791111', '790001'] },
    AS: { name: 'Assam', zips: ['781001', '785001', '786001'] },
    BR: { name: 'Bihar', zips: ['800001', '842001', '800020'] },
    CT: { name: 'Chhattisgarh', zips: ['492001', '495001', '493221'] },
    GA: { name: 'Goa', zips: ['403001', '403002', '403521'] },
    GJ: { name: 'Gujarat', zips: ['380001', '395001', '394101'] },
    HR: { name: 'Haryana', zips: ['121001', '134003', '122001'] },
    HP: { name: 'Himachal Pradesh', zips: ['171001', '176215', '175131'] },
    JH: { name: 'Jharkhand', zips: ['834001', '831001', '834002'] },
    KA: { name: 'Karnataka', zips: ['560001', '575001', '570001'] },
    KL: { name: 'Kerala', zips: ['682001', '695001', '673001'] },
    MP: { name: 'Madhya Pradesh', zips: ['452001', '462001', '492007'] },
    MH: { name: 'Maharashtra', zips: ['400001', '411001', '440001'] },
    MN: { name: 'Manipur', zips: ['795001', '795004'] },
    ML: { name: 'Meghalaya', zips: ['793001', '793002'] },
    MZ: { name: 'Mizoram', zips: ['796001', '796014'] },
    NL: { name: 'Nagaland', zips: ['797001', '797112'] },
    OR: { name: 'Odisha', zips: ['751001', '768001', '751014'] },
    PB: { name: 'Punjab', zips: ['141001', '160001', '143001'] },
    RJ: { name: 'Rajasthan', zips: ['302001', '324001', '313001'] },
    SK: { name: 'Sikkim', zips: ['737101', '737102'] },
    TN: { name: 'Tamil Nadu', zips: ['600001', '641001', '625001'] },
    TG: { name: 'Telangana', zips: ['500001', '500081', '502001'] },
    TR: { name: 'Tripura', zips: ['799001', '799007'] },
    UP: { name: 'Uttar Pradesh', zips: ['226001', '208001', '282001'] },
    UT: { name: 'Uttarakhand', zips: ['248001', '263001', '263153'] },
    WB: { name: 'West Bengal', zips: ['700001', '711101', '734001'] },
    AN: { name: 'Andaman and Nicobar Islands', zips: ['744101', '744102'] },
    CH: { name: 'Chandigarh', zips: ['160001', '160022'] },
    DH: {
      name: 'Dadra and Nagar Haveli and Daman and Diu',
      zips: ['396230', '396210'],
    },
    DL: { name: 'Delhi', zips: ['110001', '110092', '110036'] },
    JK: { name: 'Jammu and Kashmir', zips: ['190001', '180001', '192101'] },
    LA: { name: 'Ladakh', zips: ['194101', '194102'] },
    LD: { name: 'Lakshadweep', zips: ['682555', '682551'] },
    PY: { name: 'Puducherry', zips: ['605001', '605004', '605009'] },
  };

  /** Other countries: region list + sample postal/ZIP strings for dropdown */
  const INTL = {
    'United Kingdom': {
      regions: ['England', 'Scotland', 'Wales', 'Northern Ireland'],
      zips: ['SW1A 1AA', 'E1 6AN', 'G2 1DU', 'CF10 1EP'],
    },
    Australia: {
      regions: [
        'New South Wales',
        'Victoria',
        'Queensland',
        'Western Australia',
        'South Australia',
        'Tasmania',
      ],
      zips: ['2000', '3000', '4000', '5000', '6000'],
    },
    Germany: {
      regions: ['Berlin', 'Bavaria', 'North Rhine-Westphalia', 'Baden-Württemberg'],
      zips: ['10115', '80331', '50667', '70173'],
    },
    France: {
      regions: ['Île-de-France', "Provence-Alpes-Côte d'Azur", 'Auvergne-Rhône-Alpes'],
      zips: ['75001', '13001', '69001'],
    },
    Mexico: {
      regions: ['Mexico City', 'Jalisco', 'Nuevo León', 'Quintana Roo'],
      zips: ['06000', '44100', '64000', '77500'],
    },
    Brazil: {
      regions: ['São Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Federal District'],
      zips: ['01310-100', '20040-020', '30112-000', '70040-020'],
    },
    Japan: {
      regions: ['Tokyo', 'Osaka', 'Kyoto', 'Hokkaido'],
      zips: ['100-0001', '530-0001', '600-8001', '060-0001'],
    },
  };

  const COUNTRIES = [
    'United States',
    'Canada',
    'United Kingdom',
    'Australia',
    'India',
    'Germany',
    'France',
    'Mexico',
    'Brazil',
    'Japan',
    'Other',
  ];

  const INDUSTRIES = [
    'Real estate agent',
    'Hair salon',
    'Dentist',
    'Restaurant',
    'Coffee shop',
    'Auto repair shop',
    'Plumber',
    'Electrician',
    'Law firm',
    'Gym / fitness center',
    'Hotel',
    'Pharmacy',
    'Veterinarian',
    'Retail store',
    'Spa / nail salon',
    'General contractor',
    'Roofing contractor',
    'Landscaping',
    'Insurance agency',
    'Accounting firm',
    'Bank / credit union',
    'Daycare / preschool',
    'Car dealership',
    'Moving company',
  ];

  window.scraperFormData = {
    countries: COUNTRIES,
    industries: INDUSTRIES,
    usStates: US_STATES,
    canadaProvinces: CA_PROVINCES,
    indiaStates: INDIA_STATES,
    international: INTL,
  };
})();
