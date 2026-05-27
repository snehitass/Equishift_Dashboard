import React, { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Activity, Users, UserPlus, UserMinus, TrendingUp, TrendingDown, AlertCircle, Calendar, ArrowUp, ArrowDown } from 'lucide-react';

const EDStaffingDashboard = () => {
  const [selectedMonth, setSelectedMonth] = useState('February 2026');
  const [expandedShifts, setExpandedShifts] = useState({});
  const [probabilityThreshold, setProbabilityThreshold] = useState(60);
  const [expandedDayOverview, setExpandedDayOverview] = useState(false);
  const [expandedNightOverview, setExpandedNightOverview] = useState(false);
  const [expandedImpact, setExpandedImpact] = useState({});
  const [staffingAdjustments, setStaffingAdjustments] = useState({});
  const [expandedRoiSettings, setExpandedRoiSettings] = useState(false);
  
  // ROI Configuration
  const [roiSettings, setRoiSettings] = useState({
    revenuePerPatient: 800,
    doctorHourlyRate: 200,
    nurseHourlyRate: 60,
    shiftHours: 12
  });

  const toggleShiftReasoning = (dayIdx, shiftIdx) => {
    const key = `${dayIdx}-${shiftIdx}`;
    setExpandedShifts(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleImpactAnalysis = (dayIdx, shiftIdx) => {
    const key = `${dayIdx}-${shiftIdx}`;
    setExpandedImpact(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const updateStaffingLevel = (dayIdx, shiftIdx, type, value) => {
    const key = `${dayIdx}-${shiftIdx}`;
    setStaffingAdjustments(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [type]: value
      }
    }));
  };

  const calculateImpact = (baselineMetrics, recommendedChange, actualAdjustment) => {
    // Parse recommended changes - KEEP THE SIGN for decrease detection
    const recDoctorsRaw = parseFloat(recommendedChange.doctors) || 0;
    const recNursesRaw = parseFloat(recommendedChange.nurses) || 0;
    const isDecrease = recDoctorsRaw < 0 || recNursesRaw < 0;
    
    // For calculations, use absolute values
    const recDoctors = Math.abs(recDoctorsRaw);
    const recNurses = Math.abs(recNursesRaw);
    
    // Get actual adjustments (default to recommended)
    const actualDoctors = actualAdjustment?.doctors ?? recDoctorsRaw;
    const actualNurses = actualAdjustment?.nurses ?? recNursesRaw;
    
    // For DECREASE days, different logic
    if (isDecrease) {
      // baselineMetrics are already optimal for low-volume days
      // Reducing staff below recommendation makes things slightly worse
      const doctorFulfillment = recDoctors === 0 ? 1 : Math.abs(actualDoctors) / recDoctors;
      const nurseFulfillment = recNurses === 0 ? 1 : Math.abs(actualNurses) / recNurses;
      const avgFulfillment = (doctorFulfillment + nurseFulfillment) / 2;
      
      // Slight degradation if we don't reduce as much as recommended
      const penalty = 1 - avgFulfillment;
      
      return {
        waitTime: Math.round(baselineMetrics.waitTime + (penalty * 2)),
        lwobs: Math.round((baselineMetrics.lwobs + (penalty * 0.3)) * 10) / 10,
        lengthOfStay: Math.round((baselineMetrics.lengthOfStay + (penalty * 0.2)) * 10) / 10,
        census: Math.round(baselineMetrics.census + (penalty * 1)),
        level: 'good'
      };
    }
    
    // For INCREASE days (original logic)
    // Calculate how much of the recommendation is being followed
    const doctorFulfillment = recDoctors === 0 ? 1 : actualDoctors / recDoctors;
    const nurseFulfillment = recNurses === 0 ? 1 : actualNurses / recNurses;
    const avgFulfillment = (doctorFulfillment + nurseFulfillment) / 2;
    
    // baselineMetrics represent OPTIMAL performance (when AI recommendation is followed 100%)
    const optimalWait = baselineMetrics.waitTime;
    const optimalLwobs = baselineMetrics.lwobs;
    const optimalLos = baselineMetrics.lengthOfStay;
    const optimalCensus = baselineMetrics.census;
    
    // Critical metrics (0% of recommendation followed during a surge)
    const criticalWait = Math.round(optimalWait * 2.9); // Wait time nearly triples
    const criticalLwobs = Math.round(optimalLwobs * 3.4 * 10) / 10; // LWOBS more than triples
    const criticalLos = Math.round(optimalLos * 1.8 * 10) / 10; // LOS increases 80%
    const criticalCensus = Math.round(optimalCensus * 1.6); // Census increases 60%
    
    // Physical minimums (can't go below these even with infinite staff)
    const minWait = Math.round(optimalWait * 0.83);
    const minLwobs = Math.round(optimalLwobs * 0.57 * 10) / 10;
    const minLos = Math.round(optimalLos * 0.82 * 10) / 10;
    const minCensus = Math.round(optimalCensus * 0.86);
    
    let waitTime, lwobs, los, census, level;
    
    if (avgFulfillment <= 1.0) {
      // UNDERSTAFFED TO OPTIMAL: Logarithmic improvement curve
      // Using log curve: improvement = maxImprovement * log(1 + fulfillment) / log(2)
      // This creates rapid improvement early, then slowing as we approach optimal
      
      const logFactor = Math.log(1 + avgFulfillment) / Math.log(2);
      
      waitTime = Math.round(criticalWait - ((criticalWait - optimalWait) * logFactor));
      lwobs = Math.round((criticalLwobs - ((criticalLwobs - optimalLwobs) * logFactor)) * 10) / 10;
      los = Math.round((criticalLos - ((criticalLos - optimalLos) * logFactor)) * 10) / 10;
      census = Math.round(criticalCensus - ((criticalCensus - optimalCensus) * logFactor));
      
      // Determine status
      if (avgFulfillment < 0.5) {
        level = 'critical';
      } else if (avgFulfillment < 0.95) {
        level = 'warning';
      } else {
        level = 'good';
      }
      
    } else if (avgFulfillment <= 1.5) {
      // MODERATE OVERSTAFFING (100-150%): Diminishing returns
      // Small improvements approaching physical minimums
      
      const overstaffRatio = avgFulfillment - 1.0; // 0.0 to 0.5
      const diminishingFactor = Math.log(1 + overstaffRatio * 2) / Math.log(3); // Slower log curve
      
      waitTime = Math.max(minWait, Math.round(optimalWait - ((optimalWait - minWait) * diminishingFactor)));
      lwobs = Math.max(minLwobs, Math.round((optimalLwobs - ((optimalLwobs - minLwobs) * diminishingFactor)) * 10) / 10);
      los = Math.max(minLos, Math.round((optimalLos - ((optimalLos - minLos) * diminishingFactor)) * 10) / 10);
      census = Math.max(minCensus, Math.round(optimalCensus - ((optimalCensus - minCensus) * diminishingFactor)));
      
      if (avgFulfillment > 1.15) {
        level = 'warning';
      } else {
        level = 'good';
      }
      
    } else {
      // SEVERE OVERSTAFFING (>150%): Coordination penalties kick in
      // Too many people = confusion, coordination overhead, people getting in each other's way
      
      const excessStaffing = avgFulfillment - 1.5; // How much over 150%
      const penaltyFactor = excessStaffing * 0.3; // Penalty grows with overstaffing
      
      // Start from the diminished improvements at 150%, then add penalties
      const base150Wait = minWait + 1;
      const base150Lwobs = minLwobs + 0.2;
      const base150Los = minLos + 0.1;
      const base150Census = minCensus + 1;
      
      // Metrics get WORSE as coordination overhead increases
      waitTime = Math.round(base150Wait + (penaltyFactor * 3));
      lwobs = Math.round((base150Lwobs + (penaltyFactor * 0.4)) * 10) / 10;
      los = Math.round((base150Los + (penaltyFactor * 0.3)) * 10) / 10;
      census = Math.round(base150Census + (penaltyFactor * 2));
      
      level = 'warning';
    }
    
    return {
      waitTime,
      lwobs,
      lengthOfStay: los,
      census,
      level
    };
  };

  const calculateROI = (predictedPatients, currentLwobs, baselineLwobs, doctorsAdded, nursesAdded) => {
    // Calculate patients lost at current staffing level
    const patientsLostCurrent = Math.round(predictedPatients * (currentLwobs / 100));
    
    // Calculate patients lost at baseline (0 additional staff)
    const patientsLostBaseline = Math.round(predictedPatients * (baselineLwobs / 100));
    
    // Additional patients captured by adding staff
    const additionalPatientsCaptured = patientsLostBaseline - patientsLostCurrent;
    
    // Staffing cost
    const doctorCost = doctorsAdded * roiSettings.doctorHourlyRate * roiSettings.shiftHours;
    const nurseCost = nursesAdded * roiSettings.nurseHourlyRate * roiSettings.shiftHours;
    const totalStaffingCost = doctorCost + nurseCost;
    
    // Additional revenue from captured patients
    const additionalRevenue = additionalPatientsCaptured * roiSettings.revenuePerPatient;
    
    // Net profit
    const netProfit = additionalRevenue - totalStaffingCost;
    
    return {
      staffingCost: totalStaffingCost,
      additionalRevenue,
      netProfit,
      patientsLostCurrent,
      patientsLostBaseline,
      additionalPatientsCaptured
    };
  };

  // Monthly statistics per shift
  const dayShiftAverage = 125;
  const nightShiftAverage = 75;
  const optimalDoctorRatio = 28; // 1 doctor per 28 patients
  const optimalNurseRatio = 12; // 1 nurse per 12 patients
  
  const dayShiftDoctors = Math.ceil(dayShiftAverage / optimalDoctorRatio);
  const dayShiftNurses = Math.ceil(dayShiftAverage / optimalNurseRatio);
  const nightShiftDoctors = Math.ceil(nightShiftAverage / optimalDoctorRatio);
  const nightShiftNurses = Math.ceil(nightShiftAverage / optimalNurseRatio);

  // Monthly statistics
  const monthlyAverage = 200;
  const baselineDoctors = 8;
  const baselineNurses = 16;

  // Days with meaningful variance from average
  const anomalyDays = [
    {
      date: 'Feb 7',
      fullDate: 'Friday, February 7',
      predicted: 240,
      stdDev: 12,
      confidenceRange: { low: 228, high: 252 },
      variance: '+20%',
      varianceNum: 40,
      probability: 87,
      reason: 'End of week surge + local event',
      type: 'increase',
      shifts: [
        {
          name: 'Day Shift',
          time: '7:00 AM - 7:00 PM',
          doctors: '+1',
          nurses: '+3',
          needsChange: true,
          reasoning: 'Based on 40 additional patients: 1 doctor per 28 patients (industry standard), 1 nurse per 14 patients. Surge concentrated in afternoon hours.',
          baselineMetrics: { waitTime: 18, lwobs: 2.1, lengthOfStay: 3.4, census: 28 }
        },
        {
          name: 'Night Shift',
          time: '7:00 PM - 7:00 AM',
          doctors: '0',
          nurses: '+1',
          needsChange: true,
          reasoning: 'Minor spillover from day shift expected. Additional nurse for triage support during evening transition.',
          baselineMetrics: { waitTime: 12, lwobs: 1.5, lengthOfStay: 2.8, census: 18 }
        }
      ]
    },
    {
      date: 'Feb 14',
      fullDate: 'Friday, February 14',
      predicted: 230,
      stdDev: 12,
      confidenceRange: { low: 218, high: 242 },
      variance: '+15%',
      varianceNum: 30,
      probability: 88,
      reason: 'Valentine\'s Day - Friday night volume',
      type: 'increase',
      shifts: [
        {
          name: 'Day Shift',
          time: '7:00 AM - 7:00 PM',
          doctors: '+1',
          nurses: '+2',
          needsChange: true,
          reasoning: 'Modest increase of 30 patients. 1 doctor maintains optimal ratio. 2 nurses handle slightly elevated evening volume as people head out for the holiday.',
          baselineMetrics: { waitTime: 22, lwobs: 3.2, lengthOfStay: 3.8, census: 32 }
        },
        {
          name: 'Night Shift',
          time: '7:00 PM - 7:00 AM',
          doctors: '0',
          nurses: '+1',
          needsChange: true,
          reasoning: 'Evening volume expected to be slightly higher than typical Friday. Additional nurse for evening triage and late-night coverage.',
          baselineMetrics: { waitTime: 10, lwobs: 1.2, lengthOfStay: 2.6, census: 16 }
        }
      ]
    },
    {
      date: 'Feb 17',
      fullDate: 'Monday, February 17',
      predicted: 150,
      stdDev: 18,
      confidenceRange: { low: 132, high: 168 },
      variance: '-25%',
      varianceNum: -50,
      probability: 78,
      reason: 'Presidents\' Day - reduced traffic',
      type: 'decrease',
      shifts: [
        {
          name: 'Day Shift',
          time: '7:00 AM - 7:00 PM',
          doctors: '-1',
          nurses: '-2',
          needsChange: true,
          reasoning: '50 fewer patients anticipated. Reduce to 4 doctors (1:38 ratio acceptable for holiday low-acuity mix) and 9 nurses.',
          baselineMetrics: { waitTime: 14, lwobs: 1.8, lengthOfStay: 2.9, census: 22 }
        },
        {
          name: 'Night Shift',
          time: '7:00 PM - 7:00 AM',
          doctors: '0',
          nurses: '-1',
          needsChange: true,
          reasoning: 'Continued low volume overnight. Maintain minimum coverage with reduced staffing while ensuring safety protocols.',
          baselineMetrics: { waitTime: 9, lwobs: 1.0, lengthOfStay: 2.4, census: 14 }
        }
      ]
    },
    {
      date: 'Feb 21',
      fullDate: 'Friday, February 21',
      predicted: 250,
      stdDev: 14,
      confidenceRange: { low: 236, high: 264 },
      variance: '+25%',
      varianceNum: 50,
      probability: 84,
      reason: 'Weekend effect + weather forecast',
      type: 'increase',
      shifts: [
        {
          name: 'Day Shift',
          time: '7:00 AM - 7:00 PM',
          doctors: '+2',
          nurses: '+3',
          needsChange: true,
          reasoning: 'Weather-related accidents expected. 50 additional patients require 2 doctors (1:28 ratio) and 3 nurses to handle trauma and respiratory cases.',
          baselineMetrics: { waitTime: 20, lwobs: 2.8, lengthOfStay: 3.6, census: 30 }
        },
        {
          name: 'Night Shift',
          time: '7:00 PM - 7:00 AM',
          doctors: '0',
          nurses: '+1',
          needsChange: true,
          reasoning: 'Weather surge peaks during daylight hours but spillover expected. Additional nurse for evening safety.',
          baselineMetrics: { waitTime: 11, lwobs: 1.3, lengthOfStay: 2.7, census: 17 }
        }
      ]
    },
    {
      date: 'Feb 28',
      fullDate: 'Saturday, February 28',
      predicted: 228,
      stdDev: 11,
      confidenceRange: { low: 217, high: 239 },
      variance: '+14%',
      varianceNum: 28,
      probability: 81,
      reason: 'Month-end pattern',
      type: 'increase',
      shifts: [
        {
          name: 'Day Shift',
          time: '7:00 AM - 7:00 PM',
          doctors: '+1',
          nurses: '+2',
          needsChange: true,
          reasoning: 'Moderate increase of 28 patients. Single doctor addition maintains 1:29 ratio. 2 nurses handle chronic condition exacerbations common at month-end.',
          baselineMetrics: { waitTime: 17, lwobs: 2.3, lengthOfStay: 3.3, census: 26 }
        },
        {
          name: 'Night Shift',
          time: '7:00 PM - 7:00 AM',
          doctors: '0',
          nurses: '+1',
          needsChange: true,
          reasoning: 'Weekend night shift sees slight uptick. One additional nurse provides buffer for unpredictable Saturday evening volume.',
          baselineMetrics: { waitTime: 13, lwobs: 1.6, lengthOfStay: 2.9, census: 19 }
        }
      ]
    },
  ];

  // Filter anomaly days by probability threshold
  const filteredAnomalyDays = anomalyDays.filter(day => day.probability >= probabilityThreshold);

  // Monthly trend data
  const monthlyTrendData = Array.from({ length: 28 }, (_, i) => {
    const day = i + 1;
    const isAnomaly = anomalyDays.find(a => parseInt(a.date.split(' ')[1]) === day);
    return {
      day: day,
      predicted: isAnomaly ? isAnomaly.predicted : monthlyAverage + (Math.random() * 20 - 10),
      average: monthlyAverage,
      isAnomaly: !!isAnomaly
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 p-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Outfit:wght@300;400;600;700&display=swap');
        
        * {
          font-family: 'Outfit', sans-serif;
        }
        
        .mono {
          font-family: 'Space Mono', monospace;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(34, 211, 238, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(34, 211, 238, 0.6);
          }
        }
        
        .animate-slide-in {
          animation: slideIn 0.6s ease-out forwards;
        }
        
        .animate-pulse-slow {
          animation: pulse 2s ease-in-out infinite;
        }
        
        .card {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%);
          border: 1px solid rgba(148, 163, 184, 0.2);
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          animation: slideIn 0.6s ease-out forwards;
        }
        
        .card:hover {
          border-color: rgba(34, 211, 238, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }
        
        .stat-card {
          position: relative;
          overflow: hidden;
        }
        
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, currentColor, transparent);
          opacity: 0.5;
        }
        
        .increase-badge {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.3) 100%);
          border: 1px solid rgba(239, 68, 68, 0.4);
        }
        
        .decrease-badge {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.3) 100%);
          border: 1px solid rgba(34, 197, 94, 0.4);
        }
        
        .critical-alert {
          animation: glow 2s ease-in-out infinite;
        }
      `}</style>

      {/* Header */}
      <div className="mb-8 animate-slide-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              ED Capacity Intelligence
            </h1>
            <p className="text-slate-400 text-lg">Monthly Staffing Forecast</p>
          </div>
          <div className="flex gap-3">
            <select 
              className="px-6 py-3 rounded-lg font-semibold bg-slate-700/50 text-slate-300 border border-slate-600 hover:border-cyan-500 transition-all"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option>January 2026</option>
              <option>February 2026</option>
              <option>March 2026</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-slate-400 mono">
          <div className="flex items-center gap-2">
            <Calendar size={16} />
            <span>{selectedMonth}</span>
          </div>
        </div>
      </div>

      {/* Monthly Overview */}
      <div className="card rounded-xl p-8 mb-8">
        <div className="max-w-5xl">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Day Shift */}
            <div className="border-l-4 border-cyan-400 pl-6">
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">Day Shift (7 AM - 7 PM)</h3>
              <p className="text-xl text-slate-300 mb-4 leading-relaxed">
                The average number of patients per shift this month is{' '}
                <span className="font-bold text-cyan-400 mono text-2xl">{dayShiftAverage}</span>
              </p>
              
              <p className="text-xl text-slate-300 mb-4 leading-relaxed">
                <span className="font-bold text-emerald-400 mono text-2xl">{dayShiftDoctors} doctors</span>
                {' '}and{' '}
                <span className="font-bold text-emerald-400 mono text-2xl">{dayShiftNurses} nurses</span>
                {' '}are most likely needed
              </p>

              <button
                onClick={() => setExpandedDayOverview(!expandedDayOverview)}
                className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <AlertCircle size={14} />
                <span className="font-semibold">Why these numbers?</span>
                <span className={`ml-2 transition-transform ${expandedDayOverview ? 'rotate-180' : ''}`}>▼</span>
              </button>
              
              {expandedDayOverview && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-sm text-slate-300 leading-relaxed">
                    The best patient to doctor ratio is{' '}
                    <span className="font-bold text-amber-400 mono">1:{optimalDoctorRatio}</span>
                    {' '}and patient to nurse ratio is{' '}
                    <span className="font-bold text-amber-400 mono">1:{optimalNurseRatio}</span>
                    . With an average of {dayShiftAverage} patients, this requires {dayShiftDoctors} doctors and {dayShiftNurses} nurses to maintain optimal care standards.
                  </p>
                </div>
              )}
            </div>

            {/* Night Shift */}
            <div className="border-l-4 border-indigo-400 pl-6">
              <h3 className="text-lg font-semibold text-indigo-400 mb-3">Night Shift (7 PM - 7 AM)</h3>
              <p className="text-xl text-slate-300 mb-4 leading-relaxed">
                The average number of patients per shift this month is{' '}
                <span className="font-bold text-indigo-400 mono text-2xl">{nightShiftAverage}</span>
              </p>
              
              <p className="text-xl text-slate-300 mb-4 leading-relaxed">
                <span className="font-bold text-emerald-400 mono text-2xl">{nightShiftDoctors} doctors</span>
                {' '}and{' '}
                <span className="font-bold text-emerald-400 mono text-2xl">{nightShiftNurses} nurses</span>
                {' '}are most likely needed
              </p>

              <button
                onClick={() => setExpandedNightOverview(!expandedNightOverview)}
                className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <AlertCircle size={14} />
                <span className="font-semibold">Why these numbers?</span>
                <span className={`ml-2 transition-transform ${expandedNightOverview ? 'rotate-180' : ''}`}>▼</span>
              </button>
              
              {expandedNightOverview && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-sm text-slate-300 leading-relaxed">
                    The best patient to doctor ratio is{' '}
                    <span className="font-bold text-amber-400 mono">1:{optimalDoctorRatio}</span>
                    {' '}and patient to nurse ratio is{' '}
                    <span className="font-bold text-amber-400 mono">1:{optimalNurseRatio}</span>
                    . With an average of {nightShiftAverage} patients, this requires {nightShiftDoctors} doctors and {nightShiftNurses} nurses to maintain optimal care standards.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ROI Configuration Settings */}
      <div className="card rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
              <span className="text-2xl">💰</span>
              ROI Calculator Settings
            </h2>
            <p className="text-sm text-slate-400 mt-1">Configure financial parameters for ROI analysis</p>
          </div>
          <button
            onClick={() => setExpandedRoiSettings(!expandedRoiSettings)}
            className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span className="font-semibold">{expandedRoiSettings ? 'Hide' : 'Show'} Settings</span>
            <span className={`transition-transform ${expandedRoiSettings ? 'rotate-180' : ''}`}>▼</span>
          </button>
        </div>
        
        {expandedRoiSettings && (
          <div className="grid md:grid-cols-4 gap-4 pt-4 border-t border-slate-700/50">
            <div>
              <label className="block text-xs text-slate-400 mb-2">Revenue per Patient</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  value={roiSettings.revenuePerPatient}
                  onChange={(e) => setRoiSettings({...roiSettings, revenuePerPatient: parseFloat(e.target.value) || 0})}
                  className="w-full pl-8 pr-3 py-2 bg-slate-900/70 border border-slate-700 rounded text-slate-200 font-mono text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs text-slate-400 mb-2">Doctor Hourly Rate</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  value={roiSettings.doctorHourlyRate}
                  onChange={(e) => setRoiSettings({...roiSettings, doctorHourlyRate: parseFloat(e.target.value) || 0})}
                  className="w-full pl-8 pr-3 py-2 bg-slate-900/70 border border-slate-700 rounded text-slate-200 font-mono text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs text-slate-400 mb-2">Nurse Hourly Rate</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  value={roiSettings.nurseHourlyRate}
                  onChange={(e) => setRoiSettings({...roiSettings, nurseHourlyRate: parseFloat(e.target.value) || 0})}
                  className="w-full pl-8 pr-3 py-2 bg-slate-900/70 border border-slate-700 rounded text-slate-200 font-mono text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs text-slate-400 mb-2">Shift Length (hours)</label>
              <input
                type="number"
                value={roiSettings.shiftHours}
                onChange={(e) => setRoiSettings({...roiSettings, shiftHours: parseFloat(e.target.value) || 0})}
                className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded text-slate-200 font-mono text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Chart */}
      <div className="card rounded-xl p-6 mb-8" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="w-1 h-8 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full"></span>
          Monthly Patient Demand Trend
        </h2>
        
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={monthlyTrendData}>
            <defs>
              <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis 
              dataKey="day" 
              stroke="#94a3b8" 
              style={{ fontSize: '12px' }}
              label={{ value: 'Day of Month', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
            />
            <YAxis 
              stroke="#94a3b8" 
              style={{ fontSize: '12px' }}
              label={{ value: 'Patients', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1e293b', 
                border: '1px solid #334155',
                borderRadius: '8px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
              }}
              labelStyle={{ color: '#e2e8f0' }}
              formatter={(value, name) => {
                if (name === 'Predicted Patients') {
                  return [Math.round(value) + ' patients', ''];
                }
                return [Math.round(value), name];
              }}
              labelFormatter={(day) => {
                const monthName = selectedMonth.split(' ')[0]; // Get "February"
                return `${monthName} ${day}`;
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Line 
              type="monotone" 
              dataKey="average" 
              stroke="#64748b" 
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Monthly Average"
              dot={false}
            />
            <Area 
              type="monotone" 
              dataKey="predicted" 
              stroke="#22d3ee" 
              strokeWidth={3}
              fill="url(#predictedGradient)" 
              name="Predicted Patients"
              dot={(props) => {
                if (monthlyTrendData[props.index]?.isAnomaly) {
                  return <circle cx={props.cx} cy={props.cy} r={6} fill="#ef4444" stroke="#fca5a5" strokeWidth={2} />;
                }
                return null;
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
        
        <div className="mt-4 flex items-center gap-6 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Anomaly Days (shown below)</span>
          </div>
        </div>
      </div>

      {/* Anomaly Days & Staffing Recommendations */}
      <div className="card rounded-xl p-6" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
              <span className="w-1 h-8 bg-gradient-to-b from-amber-400 to-red-500 rounded-full"></span>
              Days with Meaningful Patient Demand Differences
            </h2>
            <p className="text-slate-400 ml-7">
              Predicted days this month with significant variance from the average and our staffing recommendations
            </p>
          </div>
        </div>

        {/* Probability Filter */}
        <div className="bg-slate-900/50 rounded-lg p-5 mb-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <AlertCircle size={16} className="text-cyan-400" />
              Filter by Probability Threshold
            </label>
            <div className="text-right">
              <span className="text-3xl font-bold mono text-cyan-400">{probabilityThreshold}%</span>
              <p className="text-xs text-slate-400 mt-1">
                Showing {filteredAnomalyDays.length} of {anomalyDays.length} anomaly days
              </p>
            </div>
          </div>
          
          <div className="relative">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={probabilityThreshold}
              onChange={(e) => setProbabilityThreshold(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              style={{
                background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${probabilityThreshold}%, #334155 ${probabilityThreshold}%, #334155 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
          
          <p className="text-xs text-slate-400 mt-3">
            {probabilityThreshold < 50 && "Low threshold: Showing all predictions including less certain ones"}
            {probabilityThreshold >= 50 && probabilityThreshold < 80 && "Medium threshold: Showing moderately to highly confident predictions"}
            {probabilityThreshold >= 80 && "High threshold: Showing only high-confidence predictions"}
          </p>
        </div>

        {filteredAnomalyDays.length === 0 ? (
          <div className="bg-slate-900/30 rounded-lg p-12 text-center border border-slate-700/30">
            <AlertCircle size={48} className="text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No anomaly days found at {probabilityThreshold}% probability threshold</p>
            <p className="text-slate-500 text-sm mt-2">Try lowering the threshold to see more predictions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnomalyDays.map((day, idx) => (
            <div 
              key={idx}
              className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50 hover:border-slate-600 transition-all"
            >
              {/* Header Row */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold mono text-cyan-400">{day.date.split(' ')[1]}</p>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">{day.date.split(' ')[0]}</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-slate-200">{day.fullDate}</p>
                    <p className="text-sm text-slate-400 mt-1">{day.reason}</p>
                  </div>
                </div>
                
                {/* Probability Badge */}
                <div className="text-center bg-slate-900/70 px-4 py-3 rounded-lg border border-cyan-500/30">
                  <p className="text-xs text-slate-400 mb-1">Probability</p>
                  <p className="text-2xl font-bold mono text-cyan-400">{day.probability}%</p>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
                  <p className="text-xs text-slate-400 mb-2">Predicted Patients</p>
                  <p className="text-3xl font-bold mono text-slate-200 mb-1">{day.predicted}</p>
                  <div className="text-xs text-slate-400">
                    <p className="mb-1">Range: {day.confidenceRange.low}–{day.confidenceRange.high}</p>
                    <p className="text-cyan-400">{day.probability}% confident within range</p>
                  </div>
                </div>
                
                <div className={`rounded-lg p-4 border ${
                  day.type === 'increase' 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-emerald-500/10 border-emerald-500/30'
                }`}>
                  <p className="text-xs text-slate-400 mb-2">Variance from Avg</p>
                  <div className="flex items-center gap-2">
                    {day.type === 'increase' ? (
                      <ArrowUp className="text-red-400" size={24} />
                    ) : (
                      <ArrowDown className="text-emerald-400" size={24} />
                    )}
                    <p className={`text-3xl font-bold mono ${
                      day.type === 'increase' ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {day.variance}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    ({day.type === 'increase' ? '+' : ''}{day.varianceNum} patients)
                  </p>
                </div>
              </div>

              {/* Shift-Specific Recommendations */}
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Users size={16} className="text-cyan-400" />
                  Staffing Recommendations by Shift
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {day.shifts.map((shift, shiftIdx) => {
                    const isExpanded = expandedShifts[`${idx}-${shiftIdx}`];
                    return (
                      <div 
                        key={shiftIdx}
                        className={`rounded-lg p-4 border transition-all ${
                          shift.needsChange 
                            ? 'bg-slate-900/70 border-slate-600/50' 
                            : 'bg-slate-900/30 border-slate-700/30 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-slate-200">{shift.name}</p>
                            <p className="text-xs text-slate-400 mono">{shift.time}</p>
                          </div>
                          {!shift.needsChange && (
                            <span className="text-xs bg-slate-700/50 text-slate-400 px-2 py-1 rounded">
                              No change
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Doctors</p>
                            <p className={`text-xl font-bold mono ${
                              shift.needsChange && shift.doctors !== '0'
                                ? (day.type === 'increase' ? 'text-red-400' : 'text-emerald-400')
                                : 'text-slate-500'
                            }`}>
                              {shift.doctors}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Nurses</p>
                            <p className={`text-xl font-bold mono ${
                              shift.needsChange && shift.nurses !== '0'
                                ? (day.type === 'increase' ? 'text-red-400' : 'text-emerald-400')
                                : 'text-slate-500'
                            }`}>
                              {shift.nurses}
                            </p>
                          </div>
                        </div>

                        {/* Reasoning Section */}
                        <div>
                          <button
                            onClick={() => toggleShiftReasoning(idx, shiftIdx)}
                            className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors w-full"
                          >
                            <AlertCircle size={14} />
                            <span className="font-semibold">Why these numbers?</span>
                            <span className={`ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                          </button>
                          
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-slate-700/50">
                              <p className="text-xs text-slate-300 leading-relaxed">
                                {shift.reasoning}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Impact Analysis Section */}
                        {shift.needsChange && (
                          <div className="mt-3">
                            <button
                              onClick={() => toggleImpactAnalysis(idx, shiftIdx)}
                              className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors w-full"
                            >
                              <TrendingUp size={14} />
                              <span className="font-semibold">See impact of different staffing levels</span>
                              <span className={`ml-auto transition-transform ${expandedImpact[`${idx}-${shiftIdx}`] ? 'rotate-180' : ''}`}>▼</span>
                            </button>
                            
                            {expandedImpact[`${idx}-${shiftIdx}`] && (
                              <div className="mt-3 pt-3 border-t border-slate-700/50">
                                <p className="text-xs text-slate-400 mb-3">
                                  Adjust staffing levels to see the predicted impact on ED metrics
                                </p>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="text-xs text-slate-400">
                                        Doctors to Add
                                      </label>
                                      <div className="text-right">
                                        <span className="text-lg font-bold mono text-cyan-400">
                                          {(staffingAdjustments[`${idx}-${shiftIdx}`]?.doctors ?? parseFloat(shift.doctors.replace(/[+-]/g, ''))) || 0 > 0 ? '+' : ''}
                                          {(staffingAdjustments[`${idx}-${shiftIdx}`]?.doctors ?? parseFloat(shift.doctors.replace(/[+-]/g, ''))) || 0}
                                        </span>
                                        <p className="text-xs text-slate-500">(Rec: {shift.doctors})</p>
                                      </div>
                                    </div>
                                    <input
                                      type="range"
                                      min={day.type === 'increase' ? 0 : -10}
                                      max={day.type === 'increase' ? 10 : 0}
                                      step="1"
                                      value={(staffingAdjustments[`${idx}-${shiftIdx}`]?.doctors ?? parseFloat(shift.doctors.replace(/[+-]/g, ''))) || 0}
                                      onChange={(e) => updateStaffingLevel(idx, shiftIdx, 'doctors', parseFloat(e.target.value) || 0)}
                                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                      style={{
                                        background: day.type === 'increase' 
                                          ? `linear-gradient(to right, #22d3ee 0%, #22d3ee ${((staffingAdjustments[`${idx}-${shiftIdx}`]?.doctors ?? parseFloat(shift.doctors.replace(/[+-]/g, ''))) || 0) * 10}%, #334155 ${((staffingAdjustments[`${idx}-${shiftIdx}`]?.doctors ?? parseFloat(shift.doctors.replace(/[+-]/g, ''))) || 0) * 10}%, #334155 100%)`
                                          : `linear-gradient(to right, #334155 0%, #334155 ${100 + ((staffingAdjustments[`${idx}-${shiftIdx}`]?.doctors ?? parseFloat(shift.doctors.replace(/[+-]/g, ''))) || 0) * 10}%, #22d3ee ${100 + ((staffingAdjustments[`${idx}-${shiftIdx}`]?.doctors ?? parseFloat(shift.doctors.replace(/[+-]/g, ''))) || 0) * 10}%, #22d3ee 100%)`
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="text-xs text-slate-400">
                                        Nurses to Add
                                      </label>
                                      <div className="text-right">
                                        <span className="text-lg font-bold mono text-cyan-400">
                                          {(staffingAdjustments[`${idx}-${shiftIdx}`]?.nurses ?? parseFloat(shift.nurses.replace(/[+-]/g, ''))) || 0 > 0 ? '+' : ''}
                                          {(staffingAdjustments[`${idx}-${shiftIdx}`]?.nurses ?? parseFloat(shift.nurses.replace(/[+-]/g, ''))) || 0}
                                        </span>
                                        <p className="text-xs text-slate-500">(Rec: {shift.nurses})</p>
                                      </div>
                                    </div>
                                    <input
                                      type="range"
                                      min={day.type === 'increase' ? 0 : -10}
                                      max={day.type === 'increase' ? 10 : 0}
                                      step="1"
                                      value={(staffingAdjustments[`${idx}-${shiftIdx}`]?.nurses ?? parseFloat(shift.nurses.replace(/[+-]/g, ''))) || 0}
                                      onChange={(e) => updateStaffingLevel(idx, shiftIdx, 'nurses', parseFloat(e.target.value) || 0)}
                                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                      style={{
                                        background: day.type === 'increase'
                                          ? `linear-gradient(to right, #22d3ee 0%, #22d3ee ${((staffingAdjustments[`${idx}-${shiftIdx}`]?.nurses ?? parseFloat(shift.nurses.replace(/[+-]/g, ''))) || 0) * 10}%, #334155 ${((staffingAdjustments[`${idx}-${shiftIdx}`]?.nurses ?? parseFloat(shift.nurses.replace(/[+-]/g, ''))) || 0) * 10}%, #334155 100%)`
                                          : `linear-gradient(to right, #334155 0%, #334155 ${100 + ((staffingAdjustments[`${idx}-${shiftIdx}`]?.nurses ?? parseFloat(shift.nurses.replace(/[+-]/g, ''))) || 0) * 10}%, #22d3ee ${100 + ((staffingAdjustments[`${idx}-${shiftIdx}`]?.nurses ?? parseFloat(shift.nurses.replace(/[+-]/g, ''))) || 0) * 10}%, #22d3ee 100%)`
                                      }}
                                    />
                                  </div>
                                </div>

                                {(() => {
                                  const currentAdjustment = staffingAdjustments[`${idx}-${shiftIdx}`];
                                  const metrics = calculateImpact(
                                    shift.baselineMetrics, 
                                    { doctors: shift.doctors, nurses: shift.nurses, type: day.type }, 
                                    currentAdjustment
                                  );
                                  
                                  // Calculate fulfillment for conditional messages
                                  const recDoctors = parseFloat(shift.doctors.replace(/[+-]/g, '')) || 0;
                                  const recNurses = parseFloat(shift.nurses.replace(/[+-]/g, '')) || 0;
                                  const actualDoctors = currentAdjustment?.doctors ?? recDoctors;
                                  const actualNurses = currentAdjustment?.nurses ?? recNurses;
                                  const doctorFulfillment = recDoctors === 0 ? 1 : actualDoctors / recDoctors;
                                  const nurseFulfillment = recNurses === 0 ? 1 : actualNurses / recNurses;
                                  const avgFulfillment = (doctorFulfillment + nurseFulfillment) / 2;
                                  
                                  const getColorClass = (level) => {
                                    if (level === 'good') return 'text-emerald-400 border-emerald-500/30';
                                    if (level === 'warning') return 'text-amber-400 border-amber-500/30';
                                    return 'text-red-400 border-red-500/30';
                                  };
                                  
                                  return (
                                    <>
                                      <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className={`bg-slate-900/70 rounded p-2 border ${getColorClass(metrics.level)}`}>
                                          <p className="text-xs text-slate-400 mb-1">Avg Wait Time</p>
                                          <p className={`text-lg font-bold mono ${metrics.level === 'good' ? 'text-emerald-400' : metrics.level === 'warning' ? 'text-amber-400' : 'text-red-400'}`}>
                                            {metrics.waitTime} min
                                          </p>
                                        </div>
                                        <div className={`bg-slate-900/70 rounded p-2 border ${getColorClass(metrics.level)}`}>
                                          <p className="text-xs text-slate-400 mb-1">LWOBS Rate</p>
                                          <p className={`text-lg font-bold mono ${metrics.level === 'good' ? 'text-emerald-400' : metrics.level === 'warning' ? 'text-amber-400' : 'text-red-400'}`}>
                                            {metrics.lwobs}%
                                          </p>
                                        </div>
                                        <div className={`bg-slate-900/70 rounded p-2 border ${getColorClass(metrics.level)}`}>
                                          <p className="text-xs text-slate-400 mb-1">Avg Length of Stay</p>
                                          <p className={`text-lg font-bold mono ${metrics.level === 'good' ? 'text-emerald-400' : metrics.level === 'warning' ? 'text-amber-400' : 'text-red-400'}`}>
                                            {metrics.lengthOfStay} hrs
                                          </p>
                                        </div>
                                        <div className={`bg-slate-900/70 rounded p-2 border ${getColorClass(metrics.level)}`}>
                                          <p className="text-xs text-slate-400 mb-1">Peak ED Census</p>
                                          <p className={`text-lg font-bold mono ${metrics.level === 'good' ? 'text-emerald-400' : metrics.level === 'warning' ? 'text-amber-400' : 'text-red-400'}`}>
                                            {metrics.census}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      {metrics.level === 'critical' && (
                                        <div className="bg-red-500/10 border border-red-500/30 rounded p-2 flex items-start gap-2">
                                          <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-red-300">
                                            Critical: Severely understaffed. Patient safety is compromised.
                                          </p>
                                        </div>
                                      )}
                                      {metrics.level === 'warning' && avgFulfillment < 1 && (
                                        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 flex items-start gap-2">
                                          <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-amber-300">
                                            Warning: Understaffed. Expect longer wait times and patient dissatisfaction.
                                          </p>
                                        </div>
                                      )}
                                      {metrics.level === 'warning' && avgFulfillment >= 1 && avgFulfillment < 1.5 && (
                                        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 flex items-start gap-2">
                                          <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-amber-300">
                                            Notice: Slightly overstaffed. Diminishing returns on additional staff. Consider cost vs. benefit.
                                          </p>
                                        </div>
                                      )}
                                      {metrics.level === 'warning' && avgFulfillment >= 1.5 && (
                                        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 flex items-start gap-2">
                                          <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-amber-300">
                                            Caution: Overstaffed. Coordination overhead reducing efficiency. Wasting resources.
                                          </p>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                                
                                {/* ROI Analysis Card */}
                                {(() => {
                                  const currentAdjustment = staffingAdjustments[`${idx}-${shiftIdx}`];
                                  const recDoctors = parseFloat(shift.doctors.replace(/[+-]/g, '')) || 0;
                                  const recNurses = parseFloat(shift.nurses.replace(/[+-]/g, '')) || 0;
                                  const actualDoctors = currentAdjustment?.doctors ?? recDoctors;
                                  const actualNurses = currentAdjustment?.nurses ?? recNurses;
                                  
                                  // Get metrics for baseline (0 staff) and current staffing
                                  const baselineMetrics = calculateImpact(
                                    shift.baselineMetrics,
                                    { doctors: shift.doctors, nurses: shift.nurses, type: day.type },
                                    { doctors: 0, nurses: 0 }
                                  );
                                  
                                  const currentMetrics = calculateImpact(
                                    shift.baselineMetrics,
                                    { doctors: shift.doctors, nurses: shift.nurses, type: day.type },
                                    currentAdjustment
                                  );
                                  
                                  // Calculate ROI
                                  const roi = calculateROI(
                                    day.predicted,
                                    currentMetrics.lwobs,
                                    baselineMetrics.lwobs,
                                    actualDoctors,
                                    actualNurses
                                  );
                                  
                                  const getROIColor = (netProfit) => {
                                    if (netProfit > 1000) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
                                    if (netProfit > -1000) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
                                    return 'text-red-400 border-red-500/30 bg-red-500/10';
                                  };
                                  
                                  return (
                                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                                      <div className="flex items-center gap-2 mb-3">
                                        <span className="text-lg">💰</span>
                                        <h4 className="text-sm font-semibold text-slate-300">Financial Impact</h4>
                                      </div>
                                      
                                      {/* Baseline - No Staff Added */}
                                      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <p className="text-xs font-semibold text-slate-300">If No Staff Added (Baseline)</p>
                                          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Worst Case</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <p className="text-xs text-slate-400 mb-1">Patients Lost (LWOBS)</p>
                                            <p className="text-lg font-bold mono text-red-400">{roi.patientsLostBaseline}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-slate-400 mb-1">Revenue Lost</p>
                                            <p className="text-lg font-bold mono text-red-400">
                                              -${(roi.patientsLostBaseline * roiSettings.revenuePerPatient).toLocaleString()}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Current Staffing Impact */}
                                      <div className="grid grid-cols-3 gap-2 mb-2">
                                        <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30">
                                          <p className="text-xs text-slate-400 mb-1">Staffing Cost</p>
                                          <p className="text-sm font-bold mono text-red-400">
                                            -${roi.staffingCost.toLocaleString()}
                                          </p>
                                        </div>
                                        
                                        <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30">
                                          <p className="text-xs text-slate-400 mb-1">Revenue Added</p>
                                          <p className="text-sm font-bold mono text-cyan-400">
                                            +${roi.additionalRevenue.toLocaleString()}
                                          </p>
                                        </div>
                                        
                                        <div className={`rounded p-2 border ${getROIColor(roi.netProfit)}`}>
                                          <p className="text-sm text-slate-400 mb-1">Net Benefit</p>
                                          <p className={`text-lg font-bold mono ${roi.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {roi.netProfit >= 0 ? '+' : ''}${roi.netProfit.toLocaleString()}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      <div className="text-xs text-slate-400 leading-relaxed bg-slate-900/30 rounded p-2">
                                        <p>
                                          <span className="font-semibold text-cyan-400">With staffing:</span> {roi.patientsLostCurrent} patients lost (LWOBS {currentMetrics.lwobs}%)
                                          <br/>
                                          <span className="font-semibold text-emerald-400">Patients saved:</span> {roi.additionalPatientsCaptured} × ${roiSettings.revenuePerPatient} = ${roi.additionalRevenue.toLocaleString()} revenue
                                          <br/>
                                          <span className="font-semibold ${roi.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                                            Net benefit:
                                          </span> ${Math.abs(roi.additionalRevenue).toLocaleString()} revenue - ${roi.staffingCost.toLocaleString()} cost = 
                                          <span className={`font-bold ${roi.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {' '}{roi.netProfit >= 0 ? '+' : ''}${roi.netProfit.toLocaleString()}
                                          </span>
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Badge */}
              <div className="flex items-center justify-between">
                <div className={`${
                  day.type === 'increase' 
                    ? 'increase-badge text-red-400' 
                    : 'decrease-badge text-emerald-400'
                } px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2`}>
                  {day.type === 'increase' ? (
                    <>
                      <UserPlus size={18} />
                      INCREASE STAFFING
                    </>
                  ) : (
                    <>
                      <UserMinus size={18} />
                      DECREASE STAFFING
                    </>
                  )}
                </div>
                
                <button className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold flex items-center gap-2 transition-colors">
                  View Hourly Breakdown
                  <TrendingUp size={16} />
                </button>
              </div>
            </div>
            ))}
          </div>
        )}

        {/* Monthly Staffing Summary */}
        {filteredAnomalyDays.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Users size={18} className="text-cyan-400" />
              Monthly Staffing Impact Summary
            </h3>
            
            {(() => {
              let totalStaffingCost = 0;
              let totalAdditionalRevenue = 0;
              let totalBaselineLoss = 0;
              
              filteredAnomalyDays.forEach((day, dayIdx) => {
                day.shifts.forEach((shift, shiftIdx) => {
                  if (shift.needsChange) {
                    const key = `${dayIdx}-${shiftIdx}`;
                    const adjustment = staffingAdjustments[key];
                    
                    const recDoctors = parseFloat(shift.doctors) || 0; // Keep the sign!
                    const recNurses = parseFloat(shift.nurses) || 0; // Keep the sign!
                    const actualDoctors = adjustment?.doctors ?? recDoctors;
                    const actualNurses = adjustment?.nurses ?? recNurses;
                    
                    // Get baseline and current metrics
                    const baselineMetrics = calculateImpact(
                      shift.baselineMetrics,
                      { doctors: shift.doctors, nurses: shift.nurses, type: day.type },
                      { doctors: 0, nurses: 0 }
                    );
                    
                    const currentMetrics = calculateImpact(
                      shift.baselineMetrics,
                      { doctors: shift.doctors, nurses: shift.nurses, type: day.type },
                      adjustment
                    );
                    
                    const roi = calculateROI(
                      day.predicted,
                      currentMetrics.lwobs,
                      baselineMetrics.lwobs,
                      actualDoctors,
                      actualNurses
                    );
                    
                    totalStaffingCost += roi.staffingCost;
                    totalAdditionalRevenue += roi.additionalRevenue;
                    totalBaselineLoss += roi.patientsLostBaseline * roiSettings.revenuePerPatient;
                  }
                });
              });
              
              const totalNetProfit = totalAdditionalRevenue - totalStaffingCost;
              const roiPercentage = totalStaffingCost > 0 
                ? Math.round((totalNetProfit / totalStaffingCost) * 100) 
                : 0;
              
              return (
                <>
                  {/* Hero Metric - Net Benefit */}
                  <div className={`rounded-xl p-6 mb-3 border-2 ${
                    totalNetProfit > 10000 ? 'bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-500/40' :
                    totalNetProfit > 0 ? 'bg-gradient-to-br from-amber-500/10 to-emerald-500/10 border-amber-500/40' :
                    'bg-gradient-to-br from-red-500/10 to-amber-500/10 border-red-500/40'
                  }`}>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                        Monthly Net Benefit
                      </p>
                      <div className="flex items-baseline justify-center gap-2 mb-3">
                        <p className={`text-6xl font-bold mono ${
                          totalNetProfit > 10000 ? 'text-emerald-400' :
                          totalNetProfit > 0 ? 'text-amber-400' :
                          'text-red-400'
                        }`}>
                          {totalNetProfit >= 0 ? '+' : ''}${totalNetProfit.toLocaleString()}
                        </p>
                      </div>
                      <p className={`text-base font-semibold ${
                        totalNetProfit > 10000 ? 'text-emerald-400' :
                        totalNetProfit > 0 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>
                        {totalNetProfit > 10000 ? '✓ Strong financial impact from optimal staffing' :
                         totalNetProfit > 0 ? '~ Marginal gain - consider adjusting staffing levels' :
                         '✗ Net loss - currently overstaffed for predicted volume'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Context: Opportunity Cost - right under hero */}
                  <div className="bg-gradient-to-r from-red-500/10 to-red-600/5 border border-red-500/30 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-red-400 text-xl">⚠️</span>
                      <p className="text-base font-semibold text-slate-300">
                        Without additional staff:
                      </p>
                      <p className="text-6xl font-bold mono text-red-400">
                        -${totalBaselineLoss.toLocaleString()}
                      </p>
                      <p className="text-base text-slate-300">
                        lost from LWOBS patients
                      </p>
                    </div>
                  </div>
                  
                  {/* Supporting Metrics Grid */}
                  <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/30">
                    <p className="text-sm text-slate-400 mb-2">Total Staffing Cost</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-bold mono text-slate-200">
                        ${totalStaffingCost.toLocaleString()}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Investment in additional staff
                    </p>
                  </div>

                  <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/30">
                    <p className="text-sm text-slate-400 mb-2">Additional Revenue</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-bold mono text-cyan-400">
                        ${totalAdditionalRevenue.toLocaleString()}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      From captured LWOBS patients
                    </p>
                  </div>

                  <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/30">
                    <p className="text-sm text-slate-400 mb-2">ROI</p>
                    <div className="flex items-baseline gap-2">
                      <p className={`text-3xl font-bold mono ${
                        roiPercentage > 50 ? 'text-emerald-400' :
                        roiPercentage > 0 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>
                        {roiPercentage > 0 ? '+' : ''}{roiPercentage}%
                      </p>
                    </div>
                    <p className={`text-xs mt-2 ${
                      roiPercentage > 50 ? 'text-emerald-400' :
                      roiPercentage > 0 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      Return on investment
                    </p>
                  </div>
                </div>
                </>
              );
            })()}
          </div>
        )}


        {/* Monthly ROI Summary */}
        {filteredAnomalyDays.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <span className="text-xl">💰</span>
              Monthly Financial Impact
            </h3>
            
            {(() => {
              let totalDoctorShifts = 0;
              let totalNurseShifts = 0;
              let totalStaffingCostForSummary = 0; // NEW: Track actual cost
              let avgWaitTimeImprovement = 0;
              let avgLwobsImprovement = 0;
              let avgLosImprovement = 0;
              let shiftsWithChanges = 0;
              
              filteredAnomalyDays.forEach((day, dayIdx) => {
                day.shifts.forEach((shift, shiftIdx) => {
                  if (shift.needsChange) {
                    const key = `${dayIdx}-${shiftIdx}`;
                    const adjustment = staffingAdjustments[key];
                    
                    // Parse the recommended changes (keep the sign!)
                    const recDoctors = parseFloat(shift.doctors) || 0;
                    const recNurses = parseFloat(shift.nurses) || 0;
                    
                    // Use actual adjustments if entered, otherwise use recommendations
                    const actualDoctors = adjustment?.doctors ?? recDoctors;
                    const actualNurses = adjustment?.nurses ?? recNurses;
                    
                    totalDoctorShifts += actualDoctors;
                    totalNurseShifts += actualNurses;
                    
                    // NEW: Calculate cost for this specific shift (handles negatives correctly)
                    const shiftDoctorCost = actualDoctors * roiSettings.doctorHourlyRate * roiSettings.shiftHours;
                    const shiftNurseCost = actualNurses * roiSettings.nurseHourlyRate * roiSettings.shiftHours;
                    totalStaffingCostForSummary += shiftDoctorCost + shiftNurseCost;
                    
                    // Calculate improvement by comparing no-change vs actual staffing
                    const noChangeMetrics = calculateImpact(
                      shift.baselineMetrics,
                      { doctors: shift.doctors, nurses: shift.nurses, type: day.type },
                      { doctors: 0, nurses: 0 }
                    );
                    const actualMetrics = calculateImpact(
                      shift.baselineMetrics,
                      { doctors: shift.doctors, nurses: shift.nurses, type: day.type },
                      { doctors: actualDoctors, nurses: actualNurses }
                    );
                    
                    const improvement = noChangeMetrics.waitTime - actualMetrics.waitTime;
                    const lwobsImprovement = noChangeMetrics.lwobs - actualMetrics.lwobs;
                    const losImprovement = noChangeMetrics.lengthOfStay - actualMetrics.lengthOfStay;
                    
                    console.log(`[${new Date().getTime()}] Shift:`, shift.name, 'Day:', day.date);
                    console.log('  actualDoctors:', actualDoctors, 'actualNurses:', actualNurses);
                    console.log('  noChange waitTime:', noChangeMetrics.waitTime, 'actual waitTime:', actualMetrics.waitTime);
                    console.log('  improvement:', improvement);
                    console.log('  lwobsImprovement:', lwobsImprovement);
                    console.log('  losImprovement:', losImprovement);
                    console.log('  staffingAdjustments[key]:', staffingAdjustments[key]);
                    
                    if (!isFinite(improvement) || !isFinite(lwobsImprovement) || !isFinite(losImprovement)) {
                      console.error('  ⚠️ INFINITY DETECTED!');
                    }
                    
                    avgWaitTimeImprovement += improvement;
                    avgLwobsImprovement += lwobsImprovement;
                    avgLosImprovement += losImprovement;
                    shiftsWithChanges++;
                  }
                });
              });

              console.log('=== BEFORE AVERAGING ===');
              console.log('shiftsWithChanges:', shiftsWithChanges);
              console.log('avgWaitTimeImprovement (sum):', avgWaitTimeImprovement);
              console.log('avgLwobsImprovement (sum):', avgLwobsImprovement);
              console.log('avgLosImprovement (sum):', avgLosImprovement);

              // Calculate averages
              if (shiftsWithChanges === 0) {
                // No shifts to calculate from
                avgWaitTimeImprovement = 0;
                avgLwobsImprovement = 0;
                avgLosImprovement = 0;
              } else {
                // Calculate averages
                avgWaitTimeImprovement = Math.round(avgWaitTimeImprovement / shiftsWithChanges);
                avgLwobsImprovement = Math.round((avgLwobsImprovement / shiftsWithChanges) * 10) / 10;
                avgLosImprovement = Math.round((avgLosImprovement / shiftsWithChanges) * 10) / 10;
                
                // Only reset to 0 if we got NaN/Infinity (shouldn't happen with division guard above)
                if (!isFinite(avgWaitTimeImprovement)) avgWaitTimeImprovement = 0;
                if (!isFinite(avgLwobsImprovement)) avgLwobsImprovement = 0;
                if (!isFinite(avgLosImprovement)) avgLosImprovement = 0;
              }
              
              console.log('=== AFTER AVERAGING ===');
              console.log('avgWaitTimeImprovement (final):', avgWaitTimeImprovement);
              console.log('avgLwobsImprovement (final):', avgLwobsImprovement);
              console.log('avgLosImprovement (final):', avgLosImprovement);

              const isNetIncrease = totalDoctorShifts > 0 || totalNurseShifts > 0;
              const isNetDecrease = totalDoctorShifts < 0 || totalNurseShifts < 0;
              
              return (
                <>
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/30">
                      <p className="text-sm text-slate-400 mb-2">Total Doctor Shifts</p>
                      <div className="flex items-center gap-2">
                        <p className={`text-3xl font-bold mono ${
                          totalDoctorShifts > 0 ? 'text-red-400' : totalDoctorShifts < 0 ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {totalDoctorShifts > 0 ? '+' : ''}{totalDoctorShifts}
                        </p>
                        <span className="text-sm text-slate-400">shifts</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        {totalDoctorShifts > 0 ? 'Based on your adjustments' : totalDoctorShifts < 0 ? 'Shifts can be reduced' : 'No net change'}
                      </p>
                    </div>

                    <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/30">
                      <p className="text-sm text-slate-400 mb-2">Total Nurse Shifts</p>
                      <div className="flex items-center gap-2">
                        <p className={`text-3xl font-bold mono ${
                          totalNurseShifts > 0 ? 'text-red-400' : totalNurseShifts < 0 ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {totalNurseShifts > 0 ? '+' : ''}{totalNurseShifts}
                        </p>
                        <span className="text-sm text-slate-400">shifts</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        {totalNurseShifts > 0 ? 'Based on your adjustments' : totalNurseShifts < 0 ? 'Shifts can be reduced' : 'No net change'}
                      </p>
                    </div>

                    <div className={`rounded-lg p-5 border ${
                      isNetIncrease && !isNetDecrease ? 'bg-red-500/10 border-red-500/30' : 
                      isNetDecrease && !isNetIncrease ? 'bg-emerald-500/10 border-emerald-500/30' :
                      'bg-slate-900/50 border-slate-700/30'
                    }`}>
                      <p className="text-sm text-slate-400 mb-2">Staffing Cost</p>
                      <div className="flex items-baseline gap-2 mb-1">
                        <p className={`text-3xl font-bold mono ${
                          totalStaffingCostForSummary > 0 ? 'text-red-400' : totalStaffingCostForSummary < 0 ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {totalStaffingCostForSummary > 0 ? '+' : ''}{totalStaffingCostForSummary < 0 ? '-' : ''}${Math.abs(totalStaffingCostForSummary).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        {totalStaffingCostForSummary > 0 ? `Additional labor investment` : 
                         totalStaffingCostForSummary < 0 ? `Labor cost savings` : 
                         'No cost change'}
                      </p>
                    </div>
                  </div>

                  {/* Clinical Outcomes Section */}
                  <div className={`rounded-lg p-5 border ${
                    avgWaitTimeImprovement >= 15 && avgLwobsImprovement >= 3
                      ? 'bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-500/30'
                      : avgWaitTimeImprovement >= 5 && avgLwobsImprovement >= 1
                      ? 'bg-gradient-to-br from-amber-500/10 to-emerald-500/10 border-amber-500/30'
                      : 'bg-gradient-to-br from-red-500/10 to-amber-500/10 border-red-500/30'
                  }`}>
                    <h4 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${
                      avgWaitTimeImprovement >= 15 && avgLwobsImprovement >= 3
                        ? 'text-emerald-400'
                        : avgWaitTimeImprovement >= 5 && avgLwobsImprovement >= 1
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}>
                      <TrendingUp size={16} />
                      Expected Clinical Outcomes (vs. No Changes)
                    </h4>
                    <div className="grid md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Avg Wait Time Change</p>
                        <div className="flex items-baseline gap-1">
                          <p className={`text-2xl font-bold mono ${
                            avgWaitTimeImprovement >= 10 ? 'text-emerald-400' : 
                            avgWaitTimeImprovement >= 0 ? 'text-amber-400' : 
                            'text-red-400'
                          }`}>
                            {avgWaitTimeImprovement > 0 ? '-' : avgWaitTimeImprovement < 0 ? '+' : ''}{Math.abs(avgWaitTimeImprovement)}
                          </p>
                          <span className="text-sm text-slate-400">min</span>
                        </div>
                        <p className={`text-xs mt-1 ${
                          avgWaitTimeImprovement >= 10 ? 'text-emerald-400' : 
                          avgWaitTimeImprovement >= 0 ? 'text-amber-400' : 
                          'text-red-400'
                        }`}>
                          {avgWaitTimeImprovement > 0 ? 'Improvement' : avgWaitTimeImprovement < 0 ? 'Increase' : 'No change'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400 mb-1">LWOBS Rate Change</p>
                        <div className="flex items-baseline gap-1">
                          <p className={`text-2xl font-bold mono ${
                            avgLwobsImprovement >= 2 ? 'text-emerald-400' : 
                            avgLwobsImprovement >= 0 ? 'text-amber-400' : 
                            'text-red-400'
                          }`}>
                            {avgLwobsImprovement > 0 ? '-' : avgLwobsImprovement < 0 ? '+' : ''}{Math.abs(avgLwobsImprovement)}
                          </p>
                          <span className="text-sm text-slate-400">%</span>
                        </div>
                        <p className={`text-xs mt-1 ${
                          avgLwobsImprovement >= 2 ? 'text-emerald-400' : 
                          avgLwobsImprovement >= 0 ? 'text-amber-400' : 
                          'text-red-400'
                        }`}>
                          {avgLwobsImprovement > 0 ? 'Fewer leaving' : avgLwobsImprovement < 0 ? 'More leaving' : 'No change'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400 mb-1">Length of Stay Change</p>
                        <div className="flex items-baseline gap-1">
                          <p className={`text-2xl font-bold mono ${
                            avgLosImprovement >= 0.5 ? 'text-emerald-400' : 
                            avgLosImprovement >= 0 ? 'text-amber-400' : 
                            'text-red-400'
                          }`}>
                            {avgLosImprovement > 0 ? '-' : avgLosImprovement < 0 ? '+' : ''}{Math.abs(avgLosImprovement)}
                          </p>
                          <span className="text-sm text-slate-400">hrs</span>
                        </div>
                        <p className={`text-xs mt-1 ${
                          avgLosImprovement >= 0.5 ? 'text-emerald-400' : 
                          avgLosImprovement >= 0 ? 'text-amber-400' : 
                          'text-red-400'
                        }`}>
                          {avgLosImprovement > 0 ? 'Faster flow' : avgLosImprovement < 0 ? 'Slower flow' : 'No change'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400 mb-1">Patient Experience</p>
                        <p className={`text-2xl font-bold mono ${
                          avgWaitTimeImprovement >= 15 && avgLwobsImprovement >= 3 ? 'text-emerald-400' :
                          avgWaitTimeImprovement >= 5 && avgLwobsImprovement >= 1 ? 'text-amber-400' :
                          'text-red-400'
                        }`}>
                          {avgWaitTimeImprovement >= 15 && avgLwobsImprovement >= 3 ? 'Better' :
                           avgWaitTimeImprovement >= 5 && avgLwobsImprovement >= 1 ? 'Moderate' :
                           'At Risk'}
                        </p>
                        <p className={`text-xs mt-1 ${
                          avgWaitTimeImprovement >= 15 && avgLwobsImprovement >= 3 ? 'text-emerald-400' :
                          avgWaitTimeImprovement >= 5 && avgLwobsImprovement >= 1 ? 'text-amber-400' :
                          'text-red-400'
                        }`}>
                          {avgWaitTimeImprovement >= 15 && avgLwobsImprovement >= 3 ? 'Satisfaction up' :
                           avgWaitTimeImprovement >= 5 && avgLwobsImprovement >= 1 ? 'Some improvement' :
                           'May decline'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-700/30">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {avgWaitTimeImprovement >= 15 && avgLwobsImprovement >= 3 ? (
                          <>With your staffing adjustments across {shiftsWithChanges} shifts, you're on track for significant improvements in patient care metrics and staff utilization.</>
                        ) : avgWaitTimeImprovement >= 5 && avgLwobsImprovement >= 1 ? (
                          <>Your partial staffing adjustments will provide some improvement, but consider increasing to recommended levels for optimal patient outcomes.</>
                        ) : (
                          <>Warning: Current staffing levels may result in degraded patient experience. Consider adjusting staffing closer to recommendations to avoid negative outcomes.</>
                        )}
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
        
        <div className="mt-6 pt-6 border-t border-slate-700/50">
          <div className="flex gap-3">
            <button className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-900 font-bold py-4 px-6 rounded-lg hover:shadow-lg hover:shadow-cyan-500/50 transition-all">
              Export Schedule
            </button>
            <button className="bg-slate-700/50 text-slate-300 font-semibold py-4 px-6 rounded-lg hover:bg-slate-700 transition-all">
              Adjust Parameters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EDStaffingDashboard;