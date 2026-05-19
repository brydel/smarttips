-- This is an empty migration.
ALTER TABLE tip_distributions 
ADD CONSTRAINT chk_ml_model 
CHECK (
  computation_method IN ('RULES', 'MANUAL_OVERRIDE') 
  OR ml_model_id IS NOT NULL
);