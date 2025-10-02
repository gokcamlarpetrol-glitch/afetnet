import * as Contacts from 'expo-contacts';
import { Alert } from 'react-native';
import { FamilyMember } from '../data/models';

export interface Contact {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
}

export class ContactImporter {
  private static instance: ContactImporter;

  private constructor() {}

  static getInstance(): ContactImporter {
    if (!ContactImporter.instance) {
      ContactImporter.instance = new ContactImporter();
    }
    return ContactImporter.instance;
  }

  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to request contacts permission:', error);
      return false;
    }
  }

  async importFromDevice(): Promise<Contact[]> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        Alert.alert(
          'İzin Gerekli',
          'Kişilerinizi içe aktarmak için kişi izni vermelisiniz.'
        );
        return [];
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
      });

      const contacts: Contact[] = data
        .filter(contact => contact.name && (contact.phoneNumbers?.length || contact.emails?.length))
        .map(contact => ({
          id: contact.id || Math.random().toString(),
          name: contact.name || 'Bilinmeyen Kişi',
          phoneNumber: contact.phoneNumbers?.[0]?.number,
          email: contact.emails?.[0]?.email,
        }))
        .slice(0, 100); // Limit to 100 contacts

      console.log(`Imported ${contacts.length} contacts`);
      return contacts;
    } catch (error) {
      console.error('Failed to import contacts:', error);
      Alert.alert(
        'Hata',
        'Kişiler içe aktarılırken bir hata oluştu.'
      );
      return [];
    }
  }

  async searchContacts(query: string): Promise<Contact[]> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        return [];
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
      });

      const filteredContacts = data
        .filter(contact => {
          const name = contact.name?.toLowerCase() || '';
          const phone = contact.phoneNumbers?.[0]?.number?.toLowerCase() || '';
          const email = contact.emails?.[0]?.email?.toLowerCase() || '';
          const searchQuery = query.toLowerCase();
          
          return name.includes(searchQuery) || 
                 phone.includes(searchQuery) || 
                 email.includes(searchQuery);
        })
        .map(contact => ({
          id: contact.id || Math.random().toString(),
          name: contact.name || 'Bilinmeyen Kişi',
          phoneNumber: contact.phoneNumbers?.[0]?.number,
          email: contact.emails?.[0]?.email,
        }))
        .slice(0, 20); // Limit search results

      return filteredContacts;
    } catch (error) {
      console.error('Failed to search contacts:', error);
      return [];
    }
  }

  validateContact(contact: Contact): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!contact.name || contact.name.trim().length === 0) {
      errors.push('İsim gereklidir');
    }

    if (!contact.phoneNumber && !contact.email) {
      errors.push('Telefon numarası veya e-posta gereklidir');
    }

    if (contact.phoneNumber && !this.isValidPhoneNumber(contact.phoneNumber)) {
      errors.push('Geçersiz telefon numarası');
    }

    if (contact.email && !this.isValidEmail(contact.email)) {
      errors.push('Geçersiz e-posta adresi');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Basic phone number validation
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  private isValidEmail(email: string): boolean {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Format Turkish phone numbers
    if (digits.startsWith('90')) {
      return `+${digits}`;
    } else if (digits.startsWith('0')) {
      return `+90${digits.substring(1)}`;
    } else if (digits.length === 10) {
      return `+90${digits}`;
    }
    
    return phone; // Return original if can't format
  }

  async addToFamily(contact: Contact): Promise<FamilyMember | null> {
    try {
      const validation = this.validateContact(contact);
      if (!validation.isValid) {
        Alert.alert('Geçersiz Kişi', validation.errors.join('\n'));
        return null;
      }

      // Create family member from contact
      const familyMember: Partial<FamilyMember> = {
        name: contact.name,
        phoneNumber: contact.phoneNumber ? this.formatPhoneNumber(contact.phoneNumber) : undefined,
        email: contact.email,
        shareCode: '', // Will be generated
        lastSeen: Date.now(),
        isOnline: false,
        trustLevel: 1, // Default trust level
        addedAt: Date.now(),
      };

      // Generate share code
      const shareCodeGenerator = ShareCodeGenerator.getInstance();
      familyMember.shareCode = await shareCodeGenerator.generateShareCode(familyMember.name);

      // Save to database
      const familyRepository = FamilyMemberRepository.getInstance();
      const savedMember = await familyRepository.create(familyMember);

      console.log('Contact added to family:', savedMember.name);
      return savedMember;
    } catch (error) {
      console.error('Failed to add contact to family:', error);
      Alert.alert('Hata', 'Kişi aileye eklenirken bir hata oluştu.');
      return null;
    }
  }

  async removeFromFamily(familyMemberId: string): Promise<boolean> {
    try {
      const familyRepository = FamilyMemberRepository.getInstance();
      await familyRepository.delete(familyMemberId);
      
      console.log('Family member removed:', familyMemberId);
      return true;
    } catch (error) {
      console.error('Failed to remove family member:', error);
      return false;
    }
  }

  async updateFamilyMember(familyMemberId: string, updates: Partial<FamilyMember>): Promise<boolean> {
    try {
      const familyRepository = FamilyMemberRepository.getInstance();
      await familyRepository.update(familyMemberId, updates);
      
      console.log('Family member updated:', familyMemberId);
      return true;
    } catch (error) {
      console.error('Failed to update family member:', error);
      return false;
    }
  }
}