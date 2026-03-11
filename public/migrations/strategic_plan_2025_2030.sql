-- Strategic Plan 2025-2030: replace old pillars with the four strategic pillars and add core objectives
-- Run this against your database after backing up.
-- The four pillars below REPLACE the previous set (Teaching & Learning, Research & Innovation, Governance, Infrastructure, Partnerships).

-- 1. Map existing pillar values to the four pillars (to avoid data loss)

UPDATE strategic_activities SET pillar = 'Research, Innovation & Community Engagement' WHERE pillar = 'Research & Innovation';
UPDATE strategic_activities SET pillar = 'Human Capital & Sustainability' WHERE pillar IN ('Teaching & Learning', 'Infrastructure', 'Governance');
UPDATE strategic_activities SET pillar = 'Partnerships & Internationalisation' WHERE pillar = 'Partnerships';

-- 2. Change pillar enum to 2025-2030 pillars (MySQL: any value not in the new list becomes empty string)
ALTER TABLE strategic_activities
  MODIFY COLUMN pillar ENUM(
    'Research, Innovation & Community Engagement',
    'Equity & Social Safeguards',
    'Human Capital & Sustainability',
    'Partnerships & Internationalisation'
  ) DEFAULT NULL;

-- 3. Set any empty or invalid pillar to NULL
UPDATE strategic_activities SET pillar = NULL WHERE pillar = '';

-- 4. Add core_objective column (Core Objectives: Digital Advancement, Academic Quality, Infrastructure Investment, Governance & Accountability)
-- Run the following line once; if you get "Duplicate column" then skip it.
ALTER TABLE strategic_activities ADD COLUMN core_objective VARCHAR(120) DEFAULT NULL AFTER pillar;
