-- Sprint 3: the client's Sustainability Material Questionnaire (SMQ Rev03,
-- Oceanarium) as the workspace default for material review. Row text is the
-- SMQ's own wording (whitespace tidied); Mostadam codes go in credit_code and
-- LEED references stay as text (D2). Where a row's value is the project's own
-- (fixture flow rates, U-values, SHGC, VLT), the target is left blank here and
-- filled in the project's copy (D36). Kind and note come from the SMQ's
-- 'Select Yes/No/NA/Value' column. Idempotent; skipped without the solo workspace.
INSERT INTO "smq_template" ("id", "workspace_id", "project_id", "title", "revision")
SELECT 'smq_default', w."id", NULL, 'LEED & Mostadam Material Review Questionnaire', 'Rev03'
FROM "workspace" w WHERE w."id" = 'ws_default'
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "smq_section" ("id", "template_id", "seq", "kind", "heading", "default_parts")
SELECT v.* FROM (VALUES
('smq_default_s00', 'smq_default', 0, 'all_materials', 'For all materials', '["RC-01:ksa"]'),
('smq_default_s01', 'smq_default', 1, 'material_type', 'All metals', '["MW-05:steel"]'),
('smq_default_s02', 'smq_default', 2, 'material_type', 'Aggregate (base in paved roads/curbs or building foundations)', '["MW-05:aggregates"]'),
('smq_default_s03', 'smq_default', 3, 'material_type', 'Wood products. Furniture etc', '["MW-05:timber", "HC-11:formaldehyde"]'),
('smq_default_s04', 'smq_default', 4, 'material_type', 'Non-structural elements/partitions', '[]'),
('smq_default_s05', 'smq_default', 5, 'material_type', 'Bike racks', '[]'),
('smq_default_s06', 'smq_default', 6, 'material_type', 'Priority car spaces signage', '[]'),
('smq_default_s07', 'smq_default', 7, 'material_type', 'EV Charging Station', '[]'),
('smq_default_s08', 'smq_default', 8, 'material_type', 'Pavers and Hardscape Materials', '[]'),
('smq_default_s09', 'smq_default', 9, 'material_type', 'Shading Materials (Canopies/textile shading /architectural elements)', '[]'),
('smq_default_s10', 'smq_default', 10, 'material_type', 'Roofing Finish Materials', '[]'),
('smq_default_s11', 'smq_default', 11, 'material_type', 'Landscaping works', '[]'),
('smq_default_s12', 'smq_default', 12, 'material_type', 'Indoor vegetation', '[]'),
('smq_default_s13', 'smq_default', 13, 'material_type', 'Sanitary Fittings [Lavatory faucet; Kitchen faucet; Urinals; Water closet; Showerhead; hand-held spray; Drinking fountain; Washing Machine; Dishwasher]', '[]'),
('smq_default_s14', 'smq_default', 14, 'material_type', 'Water Meters', '[]'),
('smq_default_s15', 'smq_default', 15, 'material_type', 'Water systems', '[]'),
('smq_default_s16', 'smq_default', 16, 'material_type', 'Graywater Treatment System', '[]'),
('smq_default_s17', 'smq_default', 17, 'material_type', 'Wastewater Treatment System', '[]'),
('smq_default_s18', 'smq_default', 18, 'material_type', 'Indoor lighting systems', '[]'),
('smq_default_s19', 'smq_default', 19, 'material_type', 'External Lighting', '[]'),
('smq_default_s20', 'smq_default', 20, 'material_type', 'Envelope [External walls block, insulation, Roofing system]', '[]'),
('smq_default_s21', 'smq_default', 21, 'material_type', 'Envelope [Glazing & Skylights]', '[]'),
('smq_default_s22', 'smq_default', 22, 'material_type', 'RMU, MVSG, MDB, SMDB, MCC, ATS', '[]'),
('smq_default_s23', 'smq_default', 23, 'material_type', 'Smart meters/Display Screens/Digital Display', '[]'),
('smq_default_s24', 'smq_default', 24, 'material_type', 'Envelope Commissioning', '[]'),
('smq_default_s25', 'smq_default', 25, 'material_type', 'Renewable Energy', '[]'),
('smq_default_s26', 'smq_default', 26, 'material_type', 'Energy Efficient Appliances [Refrigerators; Freezers; Dishwashers; Water coolers; Televisions; Ice machines; Air conditioners; Office equipment (computers, printers, scanners, monitors, servers); Commercial washers and dryers]', '[]'),
('smq_default_s27', 'smq_default', 27, 'material_type', 'Vertical Transportation Systems - Elevators', '[]'),
('smq_default_s28', 'smq_default', 28, 'material_type', 'Vertical Transportation Systems - Escalators', '[]'),
('smq_default_s29', 'smq_default', 29, 'material_type', 'All AC Refrigeration Units', '[]'),
('smq_default_s30', 'smq_default', 30, 'material_type', 'Fire suppression system', '[]'),
('smq_default_s31', 'smq_default', 31, 'material_type', 'No Smoking Signages', '[]'),
('smq_default_s32', 'smq_default', 32, 'material_type', 'Glare-control devices (e.g. Curtains)', '[]'),
('smq_default_s33', 'smq_default', 33, 'material_type', 'Noise calculations', '[]'),
('smq_default_s34', 'smq_default', 34, 'material_type', 'Floor, Ceiling, Wall', '[]'),
('smq_default_s35', 'smq_default', 35, 'material_type', 'Floor, Ceiling, Wall, Door', '[]'),
('smq_default_s36', 'smq_default', 36, 'material_type', 'Adhesives & Sealants', '["HC-11:voc"]'),
('smq_default_s37', 'smq_default', 37, 'material_type', 'Paints & Coatings', '["HC-11:voc"]'),
('smq_default_s38', 'smq_default', 38, 'material_type', 'Carpet, Hard Flooring', '[]'),
('smq_default_s39', 'smq_default', 39, 'material_type', 'Wall panels [e.g. all finish wall treatments (wall coverings, wall paneling, wall tile), surface wall structures such as gypsum or plaster, cubicle/curtain/partition walls, trim, interior and exterior doors, wall frames, interior and exterior windows, and window treatment]', '[]'),
('smq_default_s40', 'smq_default', 40, 'material_type', 'Ceilings', '["HC-11:formaldehyde"]'),
('smq_default_s41', 'smq_default', 41, 'material_type', 'Insulation', '["MW-04:insulation"]'),
('smq_default_s42', 'smq_default', 42, 'material_type', 'Furniture', '[]'),
('smq_default_s43', 'smq_default', 43, 'material_type', 'Permanent Entryway systems', '[]'),
('smq_default_s44', 'smq_default', 44, 'material_type', 'Flush out', '[]'),
('smq_default_s45', 'smq_default', 45, 'material_type', 'Car parking ventilation fans, monitoring sensors/devices and BMS control', '[]'),
('smq_default_s46', 'smq_default', 46, 'material_type', 'FAHUs, CO2 sensors', '[]'),
('smq_default_s47', 'smq_default', 47, 'material_type', 'AHUs/FAHUs', '[]')
) AS v("id", "template_id", "seq", "kind", "heading", "default_parts")
WHERE EXISTS (SELECT 1 FROM "smq_template" WHERE "id" = 'smq_default')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "smq_row" ("id", "section_id", "seq", "text", "leed_ref", "credit_code", "kind", "note", "value_unit")
SELECT v.* FROM (VALUES
('smq_default_s00_r01', 'smq_default_s00', 1, '1) Environmental Product Declaration (EPD): Provide any of the below:
a) Manufacturer declared life-cycle assessment with at least a cradle to gate scope.
b) Manufacturer reviewed product specific Type III EPD with at least a cradle to gate scope
c) Third party verified industry-wide Type III EPD with at least a cradle to gate scope.', 'MRc2: Building Product Disclosure and Optimization - Environmental Product Declarations', NULL, 'fixed', NULL, NULL),
('smq_default_s00_r02', 'smq_default_s00', 2, '2) Embodied Carbon/LCA Optimization:
Provide manufactures prepared Embodied Carbon/LCA Action Plan demonstrating reduction in embodied carbon with at least reduction in GWP.', 'MRc2: Building Product Disclosure and Optimization - Environmental Product Declarations', NULL, 'fixed', NULL, NULL),
('smq_default_s00_r03', 'smq_default_s00', 3, '1) A manufacturer declaration/third party certificate stating the % of post-consumer and % of pre-consumer recycled content. Note: Waste reuse from the same production line should be excluded.
2) If applicable, a manufacturer letter stating the products sourced (extracted, manufactured and purchased) is within 160 km of the project site.', 'MRc3:Building Product Disclosure and Optimization - Sourcing of Raw Materials', NULL, 'fixed', NULL, NULL),
('smq_default_s00_r04', 'smq_default_s00', 4, '3) Invoices/Purchase orders', 'MRc3:Building Product Disclosure and Optimization - Sourcing of Raw Materials', NULL, 'fixed', NULL, NULL),
('smq_default_s00_r05', 'smq_default_s00', 5, '1) Proof of manufacture in KSA, with at least one of the following conditions:
- Extracted in KSA
- Manufactured in KSA
- Final point of assembly in KSA', NULL, 'RC-01', 'fixed', NULL, NULL),
('smq_default_s00_r06', 'smq_default_s00', 6, '2) Invoices/Purchase orders', NULL, 'RC-01', 'fixed', NULL, NULL),
('smq_default_s00_r07', 'smq_default_s00', 7, 'Provide any of below documentation:
- Cradle to Cradle (C2C): Material Health Certificate or is Cradle to Cradle Certified™ Bronze level or higher.
- Declare: Designated as Red List Free, LBC Red List Free, or Declared, LBC Red List Approved or LBC Compliant
- Global Green Tag or Health Product Declaration (HPDs). Material Ingredient Optimization: Provide anyone of below: - Manufacturer prepared REACH report or PHD Report verified by Global Green TAG
- Manufacturer prepared material ingredient screening and Optimization Action Plan
- Third party verified Advanced Inventory & Assessment
- Third party verified Material Ingredient Optimization', 'MRc4: Building Product Disclosure and Optimization - Material Ingredients', NULL, 'fixed', NULL, NULL),
('smq_default_s01_r01', 'smq_default_s01', 1, '1) Material technical datasheets confirming the recycled content of steel.', 'MRc3:Building Product Disclosure and Optimization - Sourcing of Raw Materials', 'MW-05', 'fixed', NULL, '%'),
('smq_default_s01_r02', 'smq_default_s01', 2, '2) Purchase orders for all reinforcing or stressing steel installed in the project.', 'MRc3:Building Product Disclosure and Optimization - Sourcing of Raw Materials', 'MW-05', 'fixed', NULL, NULL),
('smq_default_s02_r01', 'smq_default_s02', 1, '1) Material technical datasheets confirming the recycled content of aggregate (% pre-consumer or post-consumer).', 'MRc3:Building Product Disclosure and Optimization - Sourcing of Raw Materials', 'MW-05', 'fixed', NULL, '%'),
('smq_default_s02_r02', 'smq_default_s02', 2, '2) Purchase orders of the recycled aggregates used in the project, confirming their source.', 'MRc3:Building Product Disclosure and Optimization - Sourcing of Raw Materials', 'MW-05', 'fixed', NULL, NULL),
('smq_default_s03_r01', 'smq_default_s03', 1, '1) FSC certificate for each wood product
Note: FSC-certiﬁed products qualify for credit only when purchased from a vendor with an FSC chain-of-custody certiﬁcate that is current at the time of sale. The vendor is deﬁned as the company that sells products to the project contractors and subcontractors who do not modify products oﬀ-site.', 'MRc3:Building Product Disclosure and Optimization - Sourcing of Raw Materials', 'MW-05', 'fixed', NULL, '%'),
('smq_default_s03_r02', 'smq_default_s03', 2, '2) COC certificate of the wood contractor', 'MRc3:Building Product Disclosure and Optimization - Sourcing of Raw Materials', 'MW-05', 'fixed', NULL, NULL),
('smq_default_s03_r03', 'smq_default_s03', 3, '3) Invoice(s) from the CoC certiﬁcate holder as follows:
- The invoice must have the vendor’s CoC certiﬁcate code (e.g., RA-COC-001025, SCS-COC-000345, or SGS-COC-002563). The invoice must itemize FSC-certiﬁed products and speciﬁc FSC claims.
- The invoice may aggregate the value of products, provided the cost of FSC products is isolated from other wood products and the vendor’s CoC certiﬁcate code is on the invoice.
- The invoice must show the entity being invoiced and indicate the delivery is intended for the LEED project.', 'MRc3:Building Product Disclosure and Optimization - Sourcing of Raw Materials', 'MW-05', 'fixed', NULL, NULL),
('smq_default_s03_r04', 'smq_default_s03', 4, 'Test report confirming a maximum concentration limit of 0.05 ppm of formaldehyde (0.06 mg/m2-h when expressed as emission rate) as tested either following EN-717-1:2004, following
ISO 16000-3: 2010, ISO 16000-6: 2011, ISO 16000-9: 2006, ISO 16000-11:2006, or following CEN/TS 16516: 2013 either in conjunction with AgBB or with Belgian or French legislation on VOC emission class labeling.', 'IEQc2: Low-Emitting Materials', 'HC-11', 'fixed', NULL, NULL),
('smq_default_s04_r01', 'smq_default_s04', 1, 'Manufacture’s data sheet of the installed non-structural elements highlighting flexibility in design as per credit requirements.', NULL, 'MW-07', 'fixed', NULL, NULL),
('smq_default_s05_r01', 'smq_default_s05', 1, '1) Data sheet/Manufacturer Information/shop drawings of bicycle racks with locations as per the authority approved design drawings.', 'LTc6: Bicycle Facilities', 'TC-04', 'fixed', NULL, NULL),
('smq_default_s05_r02', 'smq_default_s05', 2, '2) Purchase receipts of all shading devices installed in the bicycle parking space.', 'LTc6: Bicycle Facilities', 'TC-04', 'fixed', NULL, NULL),
('smq_default_s06_r01', 'smq_default_s06', 1, 'Signage datasheet /manufacturer Information /Shop drawings of priority car parking for carpools and electric vehicles with locations as per authority approved design drawings.', 'LTc7: Reduced Parking footprint / LTc8: Green Vehicles', NULL, 'fixed', NULL, NULL),
('smq_default_s07_r01', 'smq_default_s07', 1, '1) Technical Datasheets sowing the below specifications :
a) a Level 2 charging capacity (208 – 240 volts) or greater for each required space.
b) Comply with the relevant regional or local standard for electrical connectors, such as SAE Surface Vehicle Recommended Practice J1772, SAE Electric Vehicle Conductive Charge Coupler or IEC 62196 of the International Electrotechnical Commission for projects outside the U.S.
c) Meet the connected functionality criteria for ENERGY STAR certified EVSE and be capable of responding to time-of-use market signals (e.g. price).', 'LTc8: Green Vehicles', 'TC-01', 'fixed', NULL, NULL),
('smq_default_s07_r02', 'smq_default_s07', 2, '2) Purchase receipts for the EVSEs and shading devices.', 'LTc8: Green Vehicles', 'TC-01', 'fixed', NULL, NULL),
('smq_default_s08_r01', 'smq_default_s08', 1, 'Technical data sheet / third party test certificate as per ASTM E1980 for Solar Reflectance (SR) and 3-year aged Solar Reflectance Index (SRI) [SR ≥ 0.33 and 3-year aged SRI ≥ 45]', 'SSc5: Heat Island Reduction', 'SS-05', 'fixed', NULL, NULL),
('smq_default_s09_r01', 'smq_default_s09', 1, 'Technical data sheet / third party test certificate as per ASTM E1980 for Solar Reflectance (SR) and 3-year aged Solar Reflectance Index (SRI) [SR ≥ 0.33 and 3-year aged SRI ≥ 75]', 'SSc5: Heat Island Reduction', 'SS-05', 'fixed', NULL, NULL),
('smq_default_s10_r01', 'smq_default_s10', 1, 'Technical data sheet / third party test certificate for Solar Reflectance Index (SRI) [SRI ≥ 82]', 'SSc5: Heat Island Reduction', 'SS-05', 'fixed', NULL, NULL),
('smq_default_s11_r01', 'smq_default_s11', 1, 'Planting schedule with details of native/adaptive/drought tolerant/invasive species', 'WEp1& WEc1: Outdoor Water Use Reduction', 'W-02', 'fixed', NULL, NULL),
('smq_default_s11_r02', 'smq_default_s11', 2, 'Irrigation system strategy and details which must include: Narrative of technology, schematic diagram, manufacturer’s specifications for Master controller(s), Valves, Monitoring equipment including moisture sensors, wind sensors etc.', 'WEp1& WEc1: Outdoor Water Use Reduction', 'W-02', 'fixed', NULL, NULL),
('smq_default_s12_r01', 'smq_default_s12', 1, 'Planting schedule proposed for the interior space, water requirements and maintenance plan.', NULL, 'HC-16', 'fixed', NULL, NULL),
('smq_default_s13_r01', 'smq_default_s13', 1, 'Manufacturer data sheets confirming the flow rate of each fitting.
Note-: Toilets, urinals and shower heads must be WATER SENSE LABELED and manufacturers must
provide laboratory test reports to confirm flow rates.', 'WEp2 & WEc2 Indoor Water Use Reduction', 'W-01', 'project_value', 'As per the project targetted requiremnet. When selected than it becomes fix for rest of time for the project', NULL),
('smq_default_s14_r01', 'smq_default_s14', 1, 'Manufacturer’s data for the installed water meters to confirm required technical functionality:
- Have data ports.
- Have a pulsed output.
- Have remote data accessibility.
- Have provision to be connected to a data acquisition and management system which can store data for at least three years.
- Be capable to provide hourly, daily, weekly, monthly and annual water consumption for each meter and have logging capabilities for comparison of consumption levels to previous data.
- Be systematically labeled as per the end-use.
- Installed for ease of access and maintenance.', 'WEp3 & WEc3 Water Metering', 'W-03', 'fixed', NULL, NULL),
('smq_default_s15_r01', 'smq_default_s15', 1, '1) Test reports of Legionella testing for all relevant water-based systems, signed off by the Commissioning Agent (CxA).', NULL, 'HC-04', 'fixed', NULL, NULL),
('smq_default_s15_r02', 'smq_default_s15', 2, '2) Test reports of water quality for all installed drinking fountains, signed off by Commissioning Agent (CxA).', NULL, 'HC-04', 'fixed', NULL, NULL),
('smq_default_s15_r03', 'smq_default_s15', 3, '3) Operations & Maintenance Manuals (O&M) for the installed water fountains and equipment.', NULL, 'HC-04', 'fixed', NULL, NULL),
('smq_default_s16_r01', 'smq_default_s16', 1, 'Manufacturer’s data and specifications for the graywater treatment system.', NULL, 'W-04', 'fixed', NULL, NULL),
('smq_default_s17_r01', 'smq_default_s17', 1, 'Manufacturer’s data and specifications for the wastewater treatment system.', NULL, 'W-04', 'fixed', NULL, NULL),
('smq_default_s18_r01', 'smq_default_s18', 1, '1) Purchase receipts and technical datasheets highlighting CRI of the installed light sources, shielded luminaires and luminaires more than 53° above the center of view.', NULL, 'HC-08', 'fixed', NULL, NULL),
('smq_default_s18_r02', 'smq_default_s18', 2, '2) Purchase receipts and technical data sheets for all installed lighting systems, including those for wayfinding signage, and occupancy sensors.', NULL, 'HC-08', 'fixed', NULL, NULL),
('smq_default_s18_r03', 'smq_default_s18', 3, '3) Space wise LPD Calculation-Interior', NULL, 'E-01', 'design_package', 'As per the project targetted requiremnet. Its part of the design package', NULL),
('smq_default_s19_r01', 'smq_default_s19', 1, '1) As-built external lighting drawings and updated lighting schedule.
2) Copy of purchase orders/receipts for approved luminaires.
3) External lighting fixtures datasheet for installed lighting with lumens levels at different angles.', NULL, 'SS-06', 'fixed', NULL, NULL),
('smq_default_s19_r02', 'smq_default_s19', 2, '3) Space wise LPD Calculation-Exterior', 'EA Minimum/Optimize Energy Performance', 'E-01', 'design_package', 'As per the project targetted requiremnet. Its part of the design package', NULL),
('smq_default_s20_r01', 'smq_default_s20', 1, 'Third Party Test Certificate for Thermal Conductivity of wall blocks/roofing/insulation (W/mk)', 'EA Minimum/Optimize Energy Performance', 'E-01', 'fixed', NULL, NULL),
('smq_default_s20_r02', 'smq_default_s20', 2, 'Provide Elevation shop drawings with color code/area details with section details and U Value calculations', 'EA Minimum/Optimize Energy Performance', 'E-01', 'design_package', 'As per the project targetted requiremnet. Its part of the design package', NULL),
('smq_default_s20_r03', 'smq_default_s20', 3, 'Roof U-value', 'EA Minimum/Optimize Energy Performance', 'E-01', 'design_package', 'As per the project targetted requiremnet. Its part of the design package', 'W/m²K'),
('smq_default_s20_r04', 'smq_default_s20', 4, 'Wall U-value', 'EA Minimum/Optimize Energy Performance', 'E-01', 'design_package', 'As per the project targetted requiremnet. Its part of the design package', 'W/m²K'),
('smq_default_s20_r05', 'smq_default_s20', 5, 'Floor U-value', 'EA Minimum/Optimize Energy Performance', 'E-01', 'design_package', 'As per the project targetted requiremnet. Its part of the design package', 'W/m²K'),
('smq_default_s21_r01', 'smq_default_s21', 1, 'U-value full thermal simulation report and thermal calculations for
all glazing system with shop drawings showing psi', 'EA Minimum/Optimize Energy Performance', 'E-01', 'design_package', 'As per the project targetted requiremnet. Its part of the design package', NULL),
('smq_default_s21_r02', 'smq_default_s21', 2, 'Third party test certificate for air tightness and leakage', 'EA Minimum/Optimize Energy Performance', 'E-01', 'construction_team', 'By the constrcution team', NULL),
('smq_default_s21_r03', 'smq_default_s21', 3, 'Technical data sheet for Shading coefficient value, Solar Heat Gain Coefficient SHGC and VLT', 'EA Minimum/Optimize Energy Performance', 'E-01', 'design_package', 'As per the project targetted requiremnet. Its part of the design package', NULL),
('smq_default_s21_r04', 'smq_default_s21', 4, 'Fenestration U-value', 'EA Minimum/Optimize Energy Performance', 'E-01', 'design_package', 'As per the project targetted requiremnet. Its part of the design package', 'W/m²K'),
('smq_default_s21_r05', 'smq_default_s21', 5, 'SHGC', 'EA Minimum/Optimize Energy Performance', 'E-01', 'design_package', 'As per the project targetted requiremnet. Its part of the design package', NULL),
('smq_default_s21_r06', 'smq_default_s21', 6, 'VLT', 'EA Minimum/Optimize Energy Performance', 'E-01', 'design_package', 'As per the project targetted requiremnet. Its part of the design package', '%'),
('smq_default_s22_r01', 'smq_default_s22', 1, 'Manufacturer''s datasheet confirming the below specifications:
Technical Data sheets confirming that it can be integrated with BMS to monitor and optimize the energy performance of the building.', 'EAc3: Advanced Energy Metering', 'E-02', 'fixed', NULL, NULL),
('smq_default_s23_r01', 'smq_default_s23', 1, '1) Purchase orders/receipts for all smart meters and display screens or dashboards.', NULL, 'PMM-04', 'fixed', NULL, NULL),
('smq_default_s23_r02', 'smq_default_s23', 2, '2) Smart meter and dashboard manufacturers’ data sheets and specifications which highlight the energy and water monitoring capabilities.', NULL, 'PMM-04', 'fixed', NULL, NULL),
('smq_default_s24_r01', 'smq_default_s24', 1, '1) Pre-testing certificates for relevant installed products.
2) Signed verification report by the BECxA detailing the results of the tests conducted and confirming that the building envelope is installed and performs as designed.', NULL, 'E-03', 'fixed', NULL, NULL),
('smq_default_s25_r01', 'smq_default_s25', 1, 'Manufacturer’s technical datasheets for the SHW panels.', NULL, 'E-04', 'fixed', NULL, NULL),
('smq_default_s25_r02', 'smq_default_s25', 2, 'Manufacturer’s technical datasheets for the PV panels.', NULL, 'E-04', 'fixed', NULL, NULL),
('smq_default_s26_r01', 'smq_default_s26', 1, 'Manufacturer’s technical data sheets for each installed appliance confirming the energy efficiency rating with a minimum rating of B.', NULL, 'E-05', 'fixed', NULL, NULL),
('smq_default_s27_r01', 'smq_default_s27', 1, 'Manufacturer’s datasheets for each installed elevator model confirming the presence of:
- Standby mode features
- LED lighting with a minimum of 125 lamp lumens/Watt
- Variable speed, variable-voltage and variable frequency drive controller and motor
- Fan power
- Regenerative drive system', NULL, 'E-06', 'fixed', NULL, NULL),
('smq_default_s28_r01', 'smq_default_s28', 1, 'Manufacturer’s datasheets for each installed escalator model confirming the presence of:
- Load sensor and variable speed drive of motor
- Motion sensor
- Sequenced operations', NULL, 'E-06', 'fixed', NULL, NULL),
('smq_default_s29_r01', 'smq_default_s29', 1, 'Technical Data Sheet confirming the type and charge of refrigerant, as per the authority approved design calculations.', 'EAc4 Refrigerant Management', NULL, 'fixed', NULL, NULL),
('smq_default_s30_r01', 'smq_default_s30', 1, 'Manufacturer’s data for all purchased fire suppression systems and maintenance gases confirming zero ODP.', NULL, 'E-07', 'fixed', NULL, NULL),
('smq_default_s31_r01', 'smq_default_s31', 1, 'Manufacturer technical information of signage type and printing of no smoking selection', 'IEQp2 Environmental Tobacco Smoke Control', 'HC-05', 'fixed', NULL, NULL),
('smq_default_s32_r01', 'smq_default_s32', 1, 'Manufacturer’s technical data sheets of all installed glare-control devices.', NULL, 'HC-07', 'fixed', NULL, NULL),
('smq_default_s33_r01', 'smq_default_s33', 1, 'Field test reports (in accordance with ASTM E336) by the Acoustic Engineer confirming the noise levels in relevant areas meet the requirements.', NULL, 'HC-09', 'fixed', NULL, NULL),
('smq_default_s34_r01', 'smq_default_s34', 1, 'Field test reports confirming the sound absorption coefficient at 500, 1000. 2000 Hz', 'IEQc9: Acoustic Performance - Reverberation time', NULL, 'fixed', NULL, NULL),
('smq_default_s35_r01', 'smq_default_s35', 1, 'STC ratings for space adjacencies & Calculation, measurement narrative, or manufacturers’ data.', 'IEQc9: Acoustic Performance - Sound Transmission', NULL, 'fixed', NULL, NULL),
('smq_default_s36_r01', 'smq_default_s36', 1, '1) Data sheet or Test Report for Product VOC Content in g/l (VOC must not exceed limits listed in SCAQMD Rule 1168 (i.e. USEPA 24, etc.)
AND
2) General emission certificate as per CDPH Standard Method v1.1 or v1.2 with testing lab accreditation under ISO/IEC 17025.', 'IEQc2: Low-Emitting Materials', 'HC-11', 'fixed', 'Voc conten and VOC emission test report is required. Its should be older than 3 years', 'g/L'),
('smq_default_s37_r01', 'smq_default_s37', 1, '1) Data sheet or Test Report for Product VOC Content (g/l) complying with the VOC content requirements for wet-applied products
AND
2) General emission certificate as per CDPH Standard Method v1,1 or v1.2 2017 with testing lab accreditation under ISO/IEC 17025.', 'IEQc2: Low-Emitting Materials', 'HC-11', 'fixed', 'Voc conten and VOC emission test report is required. Its should be older than 3 years', 'g/L'),
('smq_default_s38_r01', 'smq_default_s38', 1, 'General emission certificate as per CDPH Standard Method v1.1 or v1.2 with testing lab accreditation under ISO/IEC 17025.', 'IEQc2: Low-Emitting Materials', NULL, 'fixed', 'VOC emission test report is required. Its should be older than 3 years', NULL),
('smq_default_s39_r01', 'smq_default_s39', 1, 'General emission certificate as per CDPH Standard Method v1.1 or v1.2 with testing lab accreditation under ISO/IEC 17025.', 'IEQc2: Low-Emitting Materials', NULL, 'fixed', 'VOC emission test report is required. Its should be older than 3 years', NULL),
('smq_default_s40_r01', 'smq_default_s40', 1, 'General emission certificate as per CDPH Standard Method v1.1 or v1.2 with testing lab accreditation under ISO/IEC 17025.', 'IEQc2: Low-Emitting Materials', 'HC-11', 'fixed', 'VOC emission test report is required. Its should be older than 3 years', NULL),
('smq_default_s40_r02', 'smq_default_s40', 2, 'technical datasheet with a maximum formaldehyde limit of 13.5 ppb (or 16.5 µg/m3).
NOTE: Ceiling systems such as ceramic/concrete tiles, organic-free mineral based systems, gypsum plaster, concrete, and metal are deemed to automatically comply with the maximum formaldehyde emissions credit requirements.', 'IEQc2: Low-Emitting Materials', 'HC-11', 'fixed', 'by data sheet or by test report compliance', NULL),
('smq_default_s41_r01', 'smq_default_s41', 1, 'General emission certificate as per CDPH Standard Method v1.1 or v1.2 with testing lab accreditation under ISO/IEC 17025.', 'IEQc2: Low-Emitting Materials', 'MW-04', 'fixed', 'VOC emission test report is required. Its should be older than 3 years', NULL),
('smq_default_s41_r02', 'smq_default_s41', 2, 'Material safety datasheets, technical datasheets and/or third-party test reports for all insulation products confirming compliance with each of the credit requirements:
1) Be manufactured without the use of CFCs or HCFCs.
2) Have ODP = 0 and GWP ≤ 5. Compliance is required for any blowing agent used to manufacture the insulation product or to spray it in place.
3) Have 13.5 parts per billion (ppb) or less of added formaldehyde.
4) Be non-toxic and not release toxic fumes during combustion.', 'IEQc2: Low-Emitting Materials', 'MW-04', 'fixed', 'by data sheet or by test report compliance or by manufacturer letter', NULL),
('smq_default_s42_r01', 'smq_default_s42', 1, 'Test in accordance with ANSI/BIFMA Standard Method M7.1–2011, complying with ANSI/BIFMA e3-2011 Furniture Sustainability Standard, Sections 7.6.1 and 7.6.2, using either the concentration modeling approach or the emissions factor approach', 'IEQc2: Low-Emitting Materials', NULL, 'fixed', NULL, NULL),
('smq_default_s43_r01', 'smq_default_s43', 1, 'Product datasheet with representative layouts confirming the minimum length of 3m in the primary direction of travel.', 'IEQc1: Enhanced Indoor Air Quality Strategies', NULL, 'fixed', NULL, NULL),
('smq_default_s44_r01', 'smq_default_s44', 1, '1) Report of flush-out activity confirming duration and total outdoor air supplied to the building.', NULL, 'HC-10', 'project_requirement', 'As per the project requirement', NULL),
('smq_default_s44_r02', 'smq_default_s44', 2, '2) IAQ test report confirming the methodology of air sampling and air testing, number of samples taken, concentration of air contaminants and remedial measures undertaken to address any non-compliant measurements (e.g. flush-out and re-testing).', NULL, 'HC-10', 'project_requirement', 'As per the project requirement', NULL),
('smq_default_s45_r01', 'smq_default_s45', 1, '1) Car parking ventilation fan data sheet', NULL, 'HC-14', 'fixed', NULL, NULL),
('smq_default_s45_r02', 'smq_default_s45', 2, '2) Carbon Monoxide (CO), Nitrogen Dioxide (NO2), sensors data sheets', NULL, 'HC-14', 'fixed', NULL, NULL),
('smq_default_s45_r03', 'smq_default_s45', 3, '3) BMS schematic diagram with control sequence for parking ventilation.', NULL, 'HC-14', 'fixed', NULL, NULL),
('smq_default_s46_r01', 'smq_default_s46', 1, '1) For FAHUs, provide manufacturer datasheets of air flow sensors and sequence of control from BMS.', 'IEQc1: Enhanced Indoor Air Quality Strategies', NULL, 'fixed', NULL, NULL),
('smq_default_s46_r02', 'smq_default_s46', 2, '2) Duct mounted CO2 sensors, provide manufacturer datasheets of CO2 sensors and sequence of control from BMS.', 'IEQc1: Enhanced Indoor Air Quality Strategies', NULL, 'fixed', NULL, NULL),
('smq_default_s46_r03', 'smq_default_s46', 3, '3) Wall mounted CO2 sensors (3-6ft from FFL), provide manufacturer datasheets of CO2 sensors with set points for alarming.', 'IEQc1: Enhanced Indoor Air Quality Strategies', NULL, 'fixed', NULL, NULL),
('smq_default_s47_r01', 'smq_default_s47', 1, 'Manufacturer’s technical datasheets confirming the fresh air flow rates of the proposed AHUs/FAHUs, based on commissioning test results.', NULL, 'HC-03', 'fixed', NULL, NULL)
) AS v("id", "section_id", "seq", "text", "leed_ref", "credit_code", "kind", "note", "value_unit")
WHERE EXISTS (SELECT 1 FROM "smq_template" WHERE "id" = 'smq_default')
ON CONFLICT ("id") DO NOTHING;
