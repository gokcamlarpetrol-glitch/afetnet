import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useI18n } from '../../hooks/useI18n';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface FAQItem {
  question: string;
  answer: string;
}

export const SupportScreen: React.FC = () => {
  const { t } = useI18n();
  const [isGeneratingLogs, setIsGeneratingLogs] = useState(false);

  const faqItems: FAQItem[] = [
    {
      question: t('support.faq.how_offline'),
      answer: t('support.faq.how_offline_answer'),
    },
    {
      question: t('support.faq.eew_reliable'),
      answer: t('support.faq.eew_reliable_answer'),
    },
    {
      question: t('support.faq.share_logs'),
      answer: t('support.faq.share_logs_answer'),
    },
    {
      question: t('support.faq.delete_data'),
      answer: t('support.faq.delete_data_answer'),
    },
    {
      question: t('support.faq.location_permission'),
      answer: t('support.faq.location_permission_answer'),
    },
    {
      question: t('support.faq.bluetooth_permission'),
      answer: t('support.faq.bluetooth_permission_answer'),
    },
    {
      question: t('support.faq.export_data'),
      answer: t('support.faq.export_data_answer'),
    },
  ];

  const handleContactSupport = () => {
    const email = 'support@afetnet.org';
    const subject = encodeURIComponent('AfetNet Support Request');
    const body = encodeURIComponent(
      `Please describe your issue or question here:\n\n` +
      `Device: ${Platform.OS} ${Platform.Version}\n` +
      `App Version: 1.0.0\n` +
      `Date: ${new Date().toISOString()}`
    );
    
    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;
    
    Linking.openURL(mailtoUrl).catch(() => {
      Alert.alert(
        t('support.email_error'),
        t('support.email_error_message')
      );
    });
  };

  const generateDebugLogs = async (): Promise<string> => {
    const logs = [
      `AfetNet Debug Report`,
      `Generated: ${new Date().toISOString()}`,
      `Platform: ${Platform.OS} ${Platform.Version}`,
      `App Version: 1.0.0`,
      ``,
      `Device Info:`,
      `- OS: ${Platform.OS}`,
      `- Version: ${Platform.Version}`,
      `- Manufacturer: ${Platform.constants?.Brand || 'Unknown'}`,
      ``,
      `App Settings:`,
      `- EEW Enabled: ${true}`, // This would come from actual settings
      `- P2P Enabled: ${true}`,
      `- Location Permission: ${true}`,
      `- Bluetooth Permission: ${true}`,
      ``,
      `Recent Activity:`,
      `- Last Help Request: ${new Date().toISOString()}`,
      `- P2P Messages Sent: 0`,
      `- P2P Messages Received: 0`,
      `- EEW Detections: 0`,
      ``,
      `Error Logs:`,
      `- No recent errors`,
      ``,
      `Please attach this file when contacting support.`,
    ];

    return logs.join('\n');
  };

  const handleShareLogs = async () => {
    setIsGeneratingLogs(true);
    
    try {
      const logContent = await generateDebugLogs();
      const fileName = `afetnet-debug-${Date.now()}.txt`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, logContent);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: t('support.share_logs'),
        });
      } else {
        // Fallback to Share API
        await Share.share({
          title: t('support.debug_report'),
          message: logContent,
        });
      }
    } catch (error) {
      console.error('Failed to generate logs:', error);
      Alert.alert(
        t('support.logs_error'),
        t('support.logs_error_message')
      );
    } finally {
      setIsGeneratingLogs(false);
    }
  };

  const handleOpenPrivacyPolicy = () => {
    const url = 'https://example.com/afetnet/privacy.en.html'; // Replace with actual URL
    Linking.openURL(url).catch(() => {
      Alert.alert(
        t('support.link_error'),
        t('support.link_error_message')
      );
    });
  };

  const handleOpenTerms = () => {
    const url = 'https://example.com/afetnet/terms.en.html'; // Replace with actual URL
    Linking.openURL(url).catch(() => {
      Alert.alert(
        t('support.link_error'),
        t('support.link_error_message')
      );
    });
  };

  const renderFAQItem = (item: FAQItem, index: number) => (
    <Card key={index} style={styles.faqItem}>
      <Text style={styles.faqQuestion}>{item.question}</Text>
      <Text style={styles.faqAnswer}>{item.answer}</Text>
    </Card>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('support.title')}</Text>
      
      {/* Contact Support */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('support.contact')}</Text>
        <Text style={styles.sectionDescription}>
          {t('support.contact_description')}
        </Text>
        
        <Button
          title={t('support.contact_button')}
          onPress={handleContactSupport}
          style={styles.contactButton}
        />
      </Card>

      {/* Share Logs */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('support.share_logs')}</Text>
        <Text style={styles.sectionDescription}>
          {t('support.share_logs_description')}
        </Text>
        
        <Button
          title={t('support.share_logs_button')}
          onPress={handleShareLogs}
          loading={isGeneratingLogs}
          variant="secondary"
          style={styles.logsButton}
        />
      </Card>

      {/* FAQ Section */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('support.faq_title')}</Text>
        {faqItems.map(renderFAQItem)}
      </Card>

      {/* Legal Links */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('support.legal_title')}</Text>
        
        <TouchableOpacity style={styles.legalLink} onPress={handleOpenPrivacyPolicy}>
          <Text style={styles.legalLinkText}>{t('support.privacy_policy')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.legalLink} onPress={handleOpenTerms}>
          <Text style={styles.legalLinkText}>{t('support.terms_of_use')}</Text>
        </TouchableOpacity>
      </Card>

      {/* Emergency Notice */}
      <Card style={[styles.section, styles.emergencySection]}>
        <Text style={styles.emergencyTitle}>{t('support.emergency_title')}</Text>
        <Text style={styles.emergencyText}>{t('support.emergency_text')}</Text>
        <Text style={styles.emergencyNumber}>{t('support.emergency_number')}</Text>
      </Card>

      {/* App Info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('support.app_info')}</Text>
        <Text style={styles.appInfoText}>
          {t('support.version')}: 1.0.0{'\n'}
          {t('support.build')}: 1{'\n'}
          {t('support.platform')}: {Platform.OS} {Platform.Version}
        </Text>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 16,
    color: '#cccccc',
    marginBottom: 16,
    lineHeight: 22,
  },
  contactButton: {
    marginTop: 8,
  },
  logsButton: {
    marginTop: 8,
  },
  faqItem: {
    marginBottom: 16,
    padding: 16,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 20,
  },
  legalLink: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 8,
  },
  legalLinkText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  emergencySection: {
    backgroundColor: '#2d1b1b',
    borderColor: '#e74c3c',
    borderWidth: 1,
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 8,
  },
  emergencyText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
    lineHeight: 20,
  },
  emergencyNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  appInfoText: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 20,
  },
});
