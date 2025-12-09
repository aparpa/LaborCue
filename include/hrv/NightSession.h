#ifndef NIGHTSESSION_H // Include guard: Prevents multiple inclusions of the header
#define NIGHTSESSION_H

#pragma once

#include <vector>
#include <chrono>

#include "RRInterval.h"

namespace hrv
{

    // Aggregated nightly HRV metric, aligned with the main sleep episode.
    struct NightlyHRV
    {
        std::chrono::system_clock::time_point date; // e.g., start of main sleep
        double rmssd_ms = 0.0;                      // nightly HRV in ms
    };

    // Collects R-R data for one "night" and computes HRV at the end.
    class NightSession
    {
    public:
        explicit NightSession(std::chrono::system_clock::time_point start);

        // Add a new R-R interval sample.
        void addSample(const RRIntervalSample &sample);

        // Called when the night is over. Computes HRV, clears raw data and returns
        // the nightly HRV summary. Raw R-R data are not retained after this call.
        NightlyHRV finalizeAndReset();

        bool isEmpty() const;

    private:
        std::chrono::system_clock::time_point start_time_;
        std::vector<RRIntervalSample> samples_;
    };

} // namespace hrv

#endif // NIGHTSESSION_H