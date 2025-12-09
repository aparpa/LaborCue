#ifndef RRINTERVAL_H // Include guard: Prevents multiple inclusions of the header
#define RRINTERVAL_H

#pragma once

#include <chrono>

namespace hrv
{

    // Single R-R interval sample with timestamp.
    struct RRIntervalSample
    {
        std::chrono::system_clock::time_point timestamp; // wall-clock time of sample
        double rr_ms;                                    // R-R interval in milliseconds
    };

} // namespace hrv

#endif // RRINTERVAL_H