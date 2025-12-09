#ifndef TRENDANALYZER_H // Include guard: Prevents multiple inclusions of the header
#define TRENDANALYZER_H

#pragma once

#include <vector>

#include "NightSession.h"

namespace hrv
{

    // Result of an inversion (inflection) detection pass.
    struct InversionEvent
    {
        bool detected = false; // true if an inversion was detected
        std::size_t index = 0; // index into the nightly HRV history
    };

    // Analyzes the long-term HRV trend to detect an "inversion" (inflection)
    // similar to the change from declining to rising HRV observed roughly seven
    // weeks before delivery in Jasinski et al. (2024).
    class TrendAnalyzer
    {
    public:
        // Inspect the full history of nightly HRV values and return whether
        // a new inversion event has occurred at the tail of the series.
        static InversionEvent detectInversion(const std::vector<NightlyHRV> &history);
    };

} // namespace hrv

#endif // TRENDANALYZER_H