import React from 'react';
import { ClockIcon, CalendarIcon } from '@heroicons/react/24/outline';

// Define IndexingSchedule inline to avoid import issues
interface IndexingSchedule {
  enabled: boolean;
  frequency: 'manual' | 'hourly' | 'daily' | 'weekly' | 'custom';
  time?: string;
  interval?: number;
  timezone?: string;
  days_of_week?: number[];
  cron_expression?: string;
}

interface ScheduleConfigProps {
  value: IndexingSchedule;
  onChange: (schedule: IndexingSchedule) => void;
  className?: string;
}

const ScheduleConfig: React.FC<ScheduleConfigProps> = ({
  value,
  onChange,
  className = ""
}) => {
  // const [showAdvanced] = useState(value.frequency === 'custom');

  const handleFrequencyChange = (frequency: IndexingSchedule['frequency']) => {
    const newSchedule: IndexingSchedule = {
      ...value,
      frequency,
    };

    // Set reasonable defaults based on frequency
    switch (frequency) {
      case 'manual':
        newSchedule.enabled = false;
        break;
      case 'hourly':
        newSchedule.enabled = true;
        newSchedule.interval = 6; // Every 6 hours
        break;
      case 'daily':
        newSchedule.enabled = true;
        newSchedule.time = '02:00';
        break;
      case 'weekly':
        newSchedule.enabled = true;
        newSchedule.time = '02:00';
        newSchedule.days_of_week = [1]; // Monday
        break;
      case 'custom':
        newSchedule.enabled = true;
        newSchedule.cron_expression = '0 2 * * *'; // Daily at 2 AM
        // setShowAdvanced(true); // Would be used if we had a toggle
        break;
    }

    onChange(newSchedule);
  };

  const handleTimeChange = (time: string) => {
    onChange({ ...value, time });
  };

  const handleIntervalChange = (interval: number) => {
    onChange({ ...value, interval });
  };

  const handleDaysChange = (day: number, checked: boolean) => {
    const currentDays = value.days_of_week || [];
    const newDays = checked
      ? [...currentDays, day].sort()
      : currentDays.filter(d => d !== day);
    
    onChange({ ...value, days_of_week: newDays });
  };

  const handleCronChange = (cron_expression: string) => {
    onChange({ ...value, cron_expression });
  };

  // const handleEnabledChange = (enabled: boolean) => {
  //   onChange({ ...value, enabled });
  // };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-medium text-gray-900 dark:text-gray-100">
            Automatic Indexing
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Keep your vault index synchronized automatically
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={value.enabled && value.frequency !== 'manual'}
            onChange={(e) => {
              const enabled = e.target.checked;
              if (!enabled) {
                handleFrequencyChange('manual');
              } else {
                handleFrequencyChange('daily');
              }
            }}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Frequency Selection */}
      {(value.enabled || value.frequency !== 'manual') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Frequency
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(['hourly', 'daily', 'weekly', 'custom'] as const).map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => handleFrequencyChange(freq)}
                className={`p-3 text-sm font-medium rounded-lg border transition-colors ${
                  value.frequency === freq
                    ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-center space-x-1">
                  {freq === 'hourly' && <ClockIcon className="w-4 h-4" />}
                  {(freq === 'daily' || freq === 'weekly') && <CalendarIcon className="w-4 h-4" />}
                  <span className="capitalize">{freq}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Frequency-specific settings */}
      {value.enabled && value.frequency !== 'manual' && (
        <div className="space-y-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
          {/* Hourly Settings */}
          {value.frequency === 'hourly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Every X hours
              </label>
              <select
                value={value.interval || 6}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={1}>Every hour</option>
                <option value={2}>Every 2 hours</option>
                <option value={4}>Every 4 hours</option>
                <option value={6}>Every 6 hours</option>
                <option value={12}>Every 12 hours</option>
              </select>
            </div>
          )}

          {/* Daily Settings */}
          {value.frequency === 'daily' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time of day
              </label>
              <input
                type="time"
                value={value.time || '02:00'}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Weekly Settings */}
          {value.frequency === 'weekly' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Time of day
                </label>
                <input
                  type="time"
                  value={value.time || '02:00'}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Days of the week
                </label>
                <div className="flex flex-wrap gap-2">
                  {dayNames.map((day, index) => (
                    <label key={index} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={(value.days_of_week || []).includes(index)}
                        onChange={(e) => handleDaysChange(index, e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        {day}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Custom Cron Settings */}
          {value.frequency === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cron Expression
              </label>
              <input
                type="text"
                value={value.cron_expression || '0 2 * * *'}
                onChange={(e) => handleCronChange(e.target.value)}
                placeholder="0 2 * * *"
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Format: minute hour day month day-of-week. Example: "0 2 * * *" runs daily at 2 AM
              </p>
            </div>
          )}

          {/* Timezone Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Timezone
            </label>
            <select
              value={value.timezone || 'America/New_York'}
              onChange={(e) => onChange({ ...value, timezone: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="UTC">UTC</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Asia/Tokyo">Tokyo</option>
              <option value="Asia/Shanghai">Shanghai</option>
              <option value="Australia/Sydney">Sydney</option>
            </select>
          </div>
        </div>
      )}

      {/* Schedule Summary */}
      {value.enabled && value.frequency !== 'manual' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <h5 className="text-sm font-medium text-blue-800 dark:text-blue-400 mb-1">
            Schedule Summary
          </h5>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {getScheduleSummary(value)}
          </p>
        </div>
      )}
    </div>
  );
};

function getScheduleSummary(schedule: IndexingSchedule): string {
  if (!schedule.enabled || schedule.frequency === 'manual') {
    return 'Manual indexing only';
  }

  const timezone = schedule.timezone || 'UTC';
  
  switch (schedule.frequency) {
    case 'hourly':
      return `Every ${schedule.interval || 6} hours in ${timezone}`;
    case 'daily':
      return `Daily at ${schedule.time || '02:00'} ${timezone}`;
    case 'weekly': {
      const days = schedule.days_of_week || [1];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayString = days.map(d => dayNames[d]).join(', ');
      return `Weekly on ${dayString} at ${schedule.time || '02:00'} ${timezone}`;
    }
    case 'custom':
      return `Custom: ${schedule.cron_expression || '0 2 * * *'} in ${timezone}`;
    default:
      return 'Unknown schedule';
  }
}

export default ScheduleConfig;