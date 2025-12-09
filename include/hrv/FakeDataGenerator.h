#ifndef FAKEDATAGENERATOR_H // Include guard: Prevents multiple inclusions of the header
#define FAKEDATAGENERATOR_H

#pragma once

#include <chrono>
#include <vector>

#include "NightSession.h"

namespace hrv
{

    // Simple helper to generate synthetic nightly HRV values for testing the
    // trend detection and alerting pipeline without a real device.
    class FakeDataGenerator
    {
    public:
        // Generate `nights` synthetic NightlyHRV values starting from `start_date`.
        // Pattern: HRV gradually declines and then rises, creating a clear
        // inversion suitable for development tests.
        static std::vector<NightlyHRV> generateSyntheticNightlySeries(
            std::chrono::system_clock::time_point start_date,
            int nights);
    };

} // namespace hrv

#endif // FAKEDATAGENERATOR_H