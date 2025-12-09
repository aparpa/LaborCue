#include "hrv/NightSession.h"
#include "hrv/HRVCalculator.h"

namespace hrv
{

    NightSession::NightSession(std::chrono::system_clock::time_point start)
        : start_time_(start) {}

    void NightSession::addSample(const RRIntervalSample &sample)
    {
        samples_.push_back(sample);
    }

    NightlyHRV NightSession::finalizeAndReset()
    {
        NightlyHRV nightly{};
        nightly.date = start_time_;
        nightly.rmssd_ms = HRVCalculator::computeRMSSD(samples_);

        // Privacy / storage requirement: drop raw R-R data after the night is over.
        samples_.clear();
        samples_.shrink_to_fit();

        return nightly;
    }

    bool NightSession::isEmpty() const
    {
        return samples_.empty();
    }

} // namespace hrv
