#ifndef ALERTENGINE_H // Include guard: Prevents multiple inclusions of the header
#define ALERTENGINE_H

#pragma once

#include <chrono>
#include <optional>
#include <string>
#include <vector>

#include "NightSession.h"
#include "TrendAnalyzer.h"

namespace hrv
{

    enum class AlertType
    {
        None,
        InversionInitial, // first alert, two weeks after inversion
        InversionFollowup // weekly follow-up alerts after the first
    };

    struct Alert
    {
        AlertType type = AlertType::None;
        std::chrono::system_clock::time_point scheduled_for{};
        std::string message;
    };

    // Persistent state for the alerting logic.
    struct AlertState
    {
        bool inversion_detected = false;
        std::chrono::system_clock::time_point inversion_date{};
        int followup_alerts_sent = 0; // includes the initial alert in the count
    };

    // Decides when patient notifications should fire based on inversion timing.
    class AlertEngine
    {
    public:
        AlertEngine();

        // Called once per "day" when new nightly HRV data become available.
        // Returns an Alert if an alert should be fired on the given day.
        std::optional<Alert> updateAndMaybeGetAlert(
            const std::vector<NightlyHRV> &history,
            const InversionEvent &inversion,
            std::chrono::system_clock::time_point today);

        const AlertState &state() const { return state_; }

    private:
        AlertState state_{};
    };

} // namespace hrv

#endif // ALERTENGINE_H