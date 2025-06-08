// frontend/src/components/profile/ReferralCode.js
import React, { useState, useEffect } from 'react';
import useTactileFeedback from '../../hooks/useTactileFeedback';

const ReferralCode = ({ userProfile }) => {
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const { selectionChanged, notificationOccurred } = useTactileFeedback();

  useEffect(() => {
    if (userProfile?.referralCode) {
      // !>7405< @5D5@0;L=CN AAK;:C 4;O Telegram 1>B0
      const botUsername = 'GreenLightCasino_bot'; // 0<5=8B5 =0 @50;L=>5 8<O 1>B0
      const link = `https://t.me/${botUsername}?start=${userProfile.referralCode}`;
      setShareLink(link);
    }
  }, [userProfile]);

  const handleCopyCode = async () => {
    if (userProfile?.referralCode) {
      try {
        await navigator.clipboard.writeText(userProfile.referralCode);
        setCopied(true);
        selectionChanged();
        notificationOccurred('success');

        setTimeout(() => setCopied(false), 2000);
      } catch (err) {

      }
    }
  };

  const handleCopyLink = async () => {
    if (shareLink) {
      try {
        await navigator.clipboard.writeText(shareLink);
        setCopied(true);
        selectionChanged();
        notificationOccurred('success');

        setTimeout(() => setCopied(false), 2000);
      } catch (err) {

      }
    }
  };

  const handleShare = () => {
    if (window.Telegram?.WebApp) {
      // A?>;L7C5< Telegram WebApp API 4;O H0@8=30
      const message = `<� @8A>548=O9AO : Greenlight Casino!\n\n<� A?>;L7C9 <>9 @5D5@0;L=K9 :>4: ${userProfile?.referralCode}\n\n= ;8 ?5@5E>48 ?> AAK;:5: ${shareLink}\n\n=� 3@09 8 2K83@K209 2<5AB5 A> <=>9!`;

      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(message)}`);
    } else if (navigator.share) {
      // A?>;L7C5< =0B82=K9 Web Share API
      navigator.share({
        title: 'Greenlight Casino -  5D5@0;L=0O ?@>3@0<<0',
        text: `@8A>548=O9AO : Greenlight Casino! A?>;L7C9 <>9 :>4: ${userProfile?.referralCode}`,
        url: shareLink
      });
    } else {
      // Fallback - :>?8@C5< AAK;:C
      handleCopyLink();
    }

    selectionChanged();
  };

  const getReferralStats = () => {
    const stats = userProfile?.referralStats || {};
    return {
      level: stats.level || 'bronze',
      levelName: getLevelName(stats.level || 'bronze'),
      levelIcon: getLevelIcon(stats.level || 'bronze'),
      commissionPercent: stats.commissionPercent || 5,
      totalReferrals: stats.totalReferrals || 0,
      activeReferrals: stats.activeReferrals || 0,
      totalEarned: stats.totalEarned || 0,
      referralBalance: stats.referralBalance || 0,
      totalWithdrawn: stats.totalWithdrawn || 0
    };
  };

  const getLevelName = (level) => {
    const levels = {
      bronze: '@>=70',
      silver: '!5@51@>', 
      gold: '>;>B>',
      platinum: ';0B8=0',
      vip: 'VIP'
    };
    return levels[level] || '@>=70';
  };

  const getLevelIcon = (level) => {
    const icons = {
      bronze: '>I',
      silver: '>H',
      gold: '>G', 
      platinum: '=�',
      vip: '<'
    };
    return icons[level] || '>I';
  };

  const getNextLevelInfo = (currentLevel, activeReferrals) => {
    const levelThresholds = {
      bronze: { next: 'silver', required: 6 },
      silver: { next: 'gold', required: 21 },
      gold: { next: 'platinum', required: 51 },
      platinum: { next: 'vip', required: 101 },
      vip: { next: null, required: null }
    };

    const current = levelThresholds[currentLevel];
    if (!current || !current.next) {
      return { nextLevel: null, needed: 0, progress: 100 };
    }

    const needed = Math.max(0, current.required - activeReferrals);
    const progress = Math.min(100, (activeReferrals / current.required) * 100);

    return {
      nextLevel: current.next,
      nextLevelName: getLevelName(current.next),
      nextLevelIcon: getLevelIcon(current.next),
      needed,
      progress
    };
  };

  if (!userProfile) {
    return (
      <div className="referral-code-section">
        <div className="loading-placeholder">
          <div className="spinner"></div>
          <span>03@C7:0 @5D5@0;L=KE 40==KE...</span>
        </div>
      </div>
    );
  }

  const stats = getReferralStats();
  const nextLevel = getNextLevelInfo(stats.level, stats.activeReferrals);

  return (
    <div className="referral-code-section">
      <div className="section-header">
        <h3><�  5D5@0;L=0O ?@>3@0<<0</h3>
        <span className="partner-level">
          {stats.levelIcon} {stats.levelName} " {stats.commissionPercent}%
        </span>
      </div>

      {/*  5D5@0;L=K9 :>4 8 AAK;:0 */}
      <div className="referral-info">
        <div className="referral-code-block">
          <label>0H @5D5@0;L=K9 :>4:</label>
          <div className="code-container">
            <span className="referral-code">{userProfile.referralCode || '5 A>740='}</span>
            <button 
              className={`copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopyCode}
              disabled={!userProfile.referralCode}
            >
              {copied ? ' !:>?8@>20=>' : '=� >?8@>20BL'}
            </button>
          </div>
        </div>

        <div className="referral-actions">
          <button className="share-btn primary" onClick={handleShare}>
            =� >45;8BLAO AAK;:>9
          </button>
          <button className="copy-link-btn secondary" onClick={handleCopyLink}>
            = >?8@>20BL AAK;:C
          </button>
        </div>
      </div>

      {/* !B0B8AB8:0 */}
      <div className="referral-stats">
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{stats.totalReferrals}</span>
            <span className="stat-label">A53> @5D5@0;>2</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.activeReferrals}</span>
            <span className="stat-label">:B82=KE</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.totalEarned.toFixed(2)} USDT</span>
            <span className="stat-label">A53> 70@01>B0=></span>
          </div>
          <div className="stat-item highlight">
            <span className="stat-value">{stats.referralBalance.toFixed(2)} USDT</span>
            <span className="stat-label">>ABC?=> : 2K2>4C</span>
          </div>
        </div>
      </div>

      {/* @>3@5AA : A;54CNI5<C C@>2=N */}
      {nextLevel.nextLevel && (
        <div className="level-progress">
          <div className="progress-header">
            <span>@>3@5AA 4> {nextLevel.nextLevelIcon} {nextLevel.nextLevelName}</span>
            <span className="progress-text">
              {stats.activeReferrals} / {nextLevel.needed + stats.activeReferrals} 0:B82=KE @5D5@0;>2
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${nextLevel.progress}%` }}
            ></div>
          </div>
          <div className="progress-info">
            <span>AB0;>AL: {nextLevel.needed} @5D5@0;>2</span>
          </div>
        </div>
      )}

      {/* =D>@<0F8O > :><8AA8OE */}
      <div className="commission-info">
        <h4>=� 0: MB> @01>B05B:</h4>
        <ul>
          <li>=� >;CG09B5 {stats.commissionPercent}% A :064>3> ?@>83@KH0 20H8E @5D5@0;>2</li>
          <li>=� @83;0H09B5 1>;LH5 4@C759 4;O ?>2KH5=8O C@>2=O 8 % :><8AA88</li>
          <li>= K2>48B5 70@01>B0==>5 =0 >A=>2=>9 10;0=A 2 ;N1>5 2@5<O</li>
          <li><� 8=8<0;L=0O AC<<0 2K2>40: 10 USDT</li>
        </ul>
      </div>

      {/* =>?:0 2K2>40 */}
      {stats.referralBalance >= 10 && (
        <div className="withdrawal-section">
          <button className="withdraw-btn">
            =� K25AB8 {stats.referralBalance.toFixed(2)} USDT =0 10;0=A
          </button>
        </div>
      )}

      {stats.referralBalance > 0 && stats.referralBalance < 10 && (
        <div className="withdrawal-notice">
          <span>=� 8=8<0;L=0O AC<<0 4;O 2K2>40: 10 USDT</span>
          <span>AB0;>AL 70@01>B0BL: {(10 - stats.referralBalance).toFixed(2)} USDT</span>
        </div>
      )}
    </div>
  );
};

export default ReferralCode;