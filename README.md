# LaborCue

Laborcue is a C++ backend for analyzing heart-rate variability (HRV) during pregnancy to detect changes in autonomic nervous system activity that may indicate elevated risk of early-onset labor.

The system ingests nightly R–R interval data, computes a single HRV value per night, tracks long-term trends, and schedules notifications when an “inversion” pattern in HRV is detected and persists over time.

## Repository Contents

- **Core HRV types and calculator**  
  R–R interval data structures and RMSSD-based HRV computation.

- **Nightly aggregation**  
  Logic to collect R–R + timestamps during a night and reduce them to one nightly HRV value, discarding raw R–R data afterwards.

- **Trend and inversion detection**  
  Analysis of nightly HRV history to detect an inversion (decline followed by rise).

- **Alerting engine**  
  Schedules initial and follow-up alerts based on the timing of an inversion.

- **Synthetic data and demo**  
  Fake nightly HRV series and a small demo program to exercise the pipeline without a real device.

Integration with real wearable devices and user-facing applications (mobile or web) will be layered on top of this backend.
