import { useState } from 'react';
import { HelpCircle, Book, MessageSquare, Mail, Phone, FileText, Video, ChevronDown, ChevronRight, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

const faqs = [
  {
    category: 'Getting Started',
    questions: [
      {
        question: 'How do I add new members to the system?',
        answer: 'Navigate to the Members page and click the "Add Member" button. Fill in the required information including name, contact details, and ministry assignment. You can also import multiple members using the Excel/CSV import feature.'
      },
      {
        question: 'How do I assign members to ministries?',
        answer: 'Go to the Ministries page, select a ministry, and click "Members". From there, you can add or remove members from the ministry.'
      },
      {
        question: 'How can I reset my password?',
        answer: 'Click on your profile icon in the top right corner, select "Change Password", and follow the instructions to update your password.'
      }
    ]
  },
  {
    category: 'Member Management',
    questions: [
      {
        question: 'How do I track member attendance?',
        answer: 'Use the Attendance page to record service attendance. You can mark attendance manually or use the QR code check-in feature for faster processing.'
      },
      {
        question: 'Can I archive members instead of deleting them?',
        answer: 'Yes! Use the Archive option to hide members from active lists while preserving their records. Archived members can be restored at any time.'
      },
      {
        question: 'How do I export member data?',
        answer: 'On the Members page, click the "CSV" or "Excel" export buttons to download member data. You can filter members before exporting to get specific data sets.'
      }
    ]
  },
  {
    category: 'Events & Communication',
    questions: [
      {
        question: 'How do I create and schedule events?',
        answer: 'Go to the Events page and click "Create Event". Fill in the event details, date, time, and location. You can also schedule automatic SMS reminders 24 hours before the event.'
      },
      {
        question: 'How do I send SMS to members?',
        answer: 'Navigate to the SMS page to send messages to individuals, groups, or all members. You can also schedule messages for future delivery.'
      },
      {
        question: 'Can I send targeted messages to specific ministries?',
        answer: 'Yes! When sending SMS or announcements, you can filter recipients by ministry, status, or other criteria.'
      }
    ]
  },
  {
    category: 'Reports & Analytics',
    questions: [
      {
        question: 'How do I generate ministry reports?',
        answer: 'Ministry leaders can submit reports from the Ministry Reports page. Administrators can view all reports from the All Ministry Reports page.'
      },
      {
        question: 'Where can I view attendance statistics?',
        answer: 'The Dashboard provides an overview of attendance trends. For detailed analytics, visit the Reports page to view charts and export data.'
      },
      {
        question: 'How do I track member follow-ups?',
        answer: 'Use the Member Follow-Up feature to record interactions with members. You can view all follow-ups and filter by date or member.'
      }
    ]
  }
];

const resources = [
  {
    icon: Book,
    title: 'User Guide',
    description: 'Complete documentation on all features',
    link: '#'
  },
  {
    icon: Video,
    title: 'Video Tutorials',
    description: 'Step-by-step video walkthroughs',
    link: '#'
  },
  {
    icon: FileText,
    title: 'Release Notes',
    description: 'Latest updates and new features',
    link: '#'
  }
];

export function HelpSupport() {
  const { profile } = useAuth();
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleFaq(id: string) {
    setExpandedFaq(expandedFaq === id ? null : id);
  }

  async function handleSubmitTicket(e: React.FormEvent) {
    e.preventDefault();
    
    if (!contactForm.subject || !contactForm.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Simulate API call - Replace with actual support ticket creation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Support ticket submitted successfully! We\'ll get back to you soon.');
      setContactForm({ subject: '', message: '' });
    } catch (error) {
      toast.error('Failed to submit ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Help & Support</h1>
        <p className="text-sm text-slate-500 mt-1">Get help and find answers to common questions</p>
      </div>

      {/* Quick Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-center">
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-3">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Email Support</h3>
            <p className="text-sm text-slate-500 mb-3">support@abesdac-connect.org</p>
            <a 
              href="mailto:support@abesdac-connect.org" 
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Send Email
            </a>
          </div>
        </Card>

        <Card className="text-center">
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-3">
              <Phone className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Phone Support</h3>
            <p className="text-sm text-slate-500 mb-3">+233 XX XXX XXXX</p>
            <a 
              href="tel:+233XXXXXXXXX" 
              className="text-sm text-green-600 hover:text-green-700 font-medium"
            >
              Call Now
            </a>
          </div>
        </Card>

        <Card className="text-center">
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 mb-3">
              <MessageSquare className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Live Chat</h3>
            <p className="text-sm text-slate-500 mb-3">Mon-Fri, 9am-5pm GMT</p>
            <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
              Start Chat
            </button>
          </div>
        </Card>
      </div>

      {/* Resources Section */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {resources.map((resource, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 flex-shrink-0">
                  <resource.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 mb-1">{resource.title}</h3>
                  <p className="text-sm text-slate-500">{resource.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">{category.category}</h3>
              <div className="space-y-2">
                {category.questions.map((faq, faqIndex) => {
                  const faqId = `${categoryIndex}-${faqIndex}`;
                  const isExpanded = expandedFaq === faqId;
                  
                  return (
                    <Card key={faqId} className="cursor-pointer hover:shadow-sm transition-shadow">
                      <button
                        onClick={() => toggleFaq(faqId)}
                        className="w-full flex items-start justify-between gap-3 text-left"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-900 mb-1">{faq.question}</h4>
                            {isExpanded && (
                              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                                {faq.answer}
                              </p>
                            )}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-slate-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                        )}
                      </button>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Form */}
      <Card>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Submit a Support Ticket</h2>
        <p className="text-sm text-slate-500 mb-6">
          Can't find what you're looking for? Send us a message and we'll get back to you as soon as possible.
        </p>
        
        <form onSubmit={handleSubmitTicket} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Your Name"
              value={profile?.full_name || ''}
              disabled
            />
            <Input
              label="Email"
              value={profile?.email || ''}
              disabled
            />
          </div>
          
          <Input
            label="Subject"
            placeholder="Brief description of your issue"
            value={contactForm.subject}
            onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
            required
          />
          
          <Textarea
            label="Message"
            placeholder="Describe your issue or question in detail..."
            rows={6}
            value={contactForm.message}
            onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
            required
          />
          
          <div className="flex justify-end">
            <Button type="submit" isLoading={isSubmitting}>
              <Send className="h-4 w-4" />
              Submit Ticket
            </Button>
          </div>
        </form>
      </Card>

      {/* System Information */}
      <Card className="bg-slate-50">
        <h3 className="font-semibold text-slate-900 mb-3">System Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-500">Version:</span>
            <span className="ml-2 font-medium text-slate-900">4.1.0</span>
          </div>
          <div>
            <span className="text-slate-500">Your Role:</span>
            <span className="ml-2 font-medium text-slate-900 capitalize">
              {profile?.role.replace('_', ' ')}
            </span>
          </div>
          <div>
            <span className="text-slate-500">User ID:</span>
            <span className="ml-2 font-medium text-slate-900">{profile?.id.slice(0, 8)}...</span>
          </div>
          <div>
            <span className="text-slate-500">Last Updated:</span>
            <span className="ml-2 font-medium text-slate-900">August 31, 2026</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
