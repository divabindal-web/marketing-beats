'use client';

import { useState, useMemo } from 'react';
import { User, UserRole, levelToRole } from '@/types';
import EditUserModal from '@/components/user-management/EditUserModal';
import { ChevronUp, ChevronDown, Edit2, Search, UserPlus } from 'lucide-react';

// All 69 employees from the CSV
const ALL_USERS: User[] = [
  {
    id: 'user-lalit-bhardwaj',
    employee_code: 'SBL0055',
    name: 'Lalit Bhardwaj',
    email: 'lalit.bhardwaj@squareyards.com',
    level: 'S3',
    location: 'Gurugram',
    designation: 'AVP - Brand Design',
    department: 'Marketing',
    supervisor_code: 'SQY44089',
    supervisor_name: 'Divya Krishnan',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-nitin-kumar',
    employee_code: 'SBL0065',
    name: 'Nitin Kumar',
    email: 'nitin.kumar@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Manager - SEO',
    department: 'Marketing',
    supervisor_code: 'SQY59542',
    supervisor_name: 'Shivam Chanana',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-rohit-rajoriya',
    employee_code: 'SBL0105',
    name: 'Rohit Rajoriya',
    email: 'rohit.rajoriya@squareyards.com',
    level: 'S2',
    location: 'Mumbai',
    designation: 'Senior Manager',
    department: 'Marketing',
    supervisor_code: 'SQY44089',
    supervisor_name: 'Divya Krishnan',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-sukhmani',
    employee_code: 'SDC4035',
    name: 'Sukhmani',
    email: 'sukhmani@squareyards.com',
    level: 'S3',
    location: 'Gurugram',
    designation: 'Associate Vice President',
    department: 'Marketing',
    supervisor_code: 'SQY44089',
    supervisor_name: 'Divya Krishnan',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-sunita-kumari',
    employee_code: 'SDC4564',
    name: 'Sunita Kumari',
    email: 'sunita.kumari@squareyards.com',
    level: 'S2',
    location: 'Gurugram',
    designation: 'Manager - Brand Design',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-sandeep-chaurasia',
    employee_code: 'SDC4682',
    name: 'Sandeep Chaurasia',
    email: 'sandeep.chaurasia@squareyards.com',
    level: 'S2',
    location: 'Gurugram',
    designation: 'Brand Design Lead',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-divya-garg',
    employee_code: 'SDC4963',
    name: 'Divya Garg',
    email: 'divya.garg@squareyards.com',
    level: 'S2',
    location: 'Gurugram',
    designation: 'Manager - Brand Design',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-shiv-kumar-gupta',
    employee_code: 'SDC5026',
    name: 'Shiv Kumar Gupta',
    email: 'shiv.kumar@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Manager - SEO',
    department: 'Marketing',
    supervisor_code: 'SQY59542',
    supervisor_name: 'Shivam Chanana',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-gaurav-dhiman',
    employee_code: 'SDC5216',
    name: 'Gaurav Dhiman',
    email: 'gaurav.dhiman@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'SEO Executive',
    department: 'Marketing',
    supervisor_code: 'SDC5674',
    supervisor_name: 'Vikesh Verma',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-ashish-singh',
    employee_code: 'SDC5405',
    name: 'Ashish Singh',
    email: 'ashish.singh@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Product Manager',
    department: 'Marketing',
    supervisor_code: 'SQY44089',
    supervisor_name: 'Divya Krishnan',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-kunal-sachdeva',
    employee_code: 'SDC5595',
    name: 'Kunal Sachdeva',
    email: 'kunal.sachdeva@squareyards.com',
    level: 'S2',
    location: 'Gurugram',
    designation: 'AGM - Content',
    department: 'Marketing',
    supervisor_code: 'SQY59401',
    supervisor_name: 'Sunita Mishra',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-vimal-vijayan',
    employee_code: 'SDC5596',
    name: 'Vimal Vijayan',
    email: 'vimal.vijayan@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Senior Content Editor',
    department: 'Marketing',
    supervisor_code: 'SDC5595',
    supervisor_name: 'Kunal Sachdeva',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-supriya-boruah',
    employee_code: 'SBL2166',
    name: 'Supriya Boruah',
    email: 'supriya.boruah@squareyards.com',
    level: 'S1',
    location: 'Mumbai',
    designation: 'Sr Executive - Marketing',
    department: 'Marketing',
    supervisor_code: 'SBL0105',
    supervisor_name: 'Rohit Rajoriya',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-vikesh-verma',
    employee_code: 'SDC5674',
    name: 'Vikesh Verma',
    email: 'vikesh.verma@squareyards.com',
    level: 'S2',
    location: 'Gurugram',
    designation: 'AGM - SEO',
    department: 'Marketing',
    supervisor_code: 'SQY59542',
    supervisor_name: 'Shivam Chanana',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-abhishek-kumar-singh',
    employee_code: 'SQY35817',
    name: 'Abhishek Kumar Singh',
    email: 'abhishek.singh@squareyards.com',
    level: 'S2',
    location: 'Gurugram',
    designation: 'AGM - SEO',
    department: 'Marketing',
    supervisor_code: 'SQY59542',
    supervisor_name: 'Shivam Chanana',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-karan-deep',
    employee_code: 'SQY36075',
    name: 'Karan Deep',
    email: 'karan.deep@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Web Developer',
    department: 'Marketing',
    supervisor_code: 'SQY56122',
    supervisor_name: 'Paramjeet',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-ankur-rawat',
    employee_code: 'SQY38120',
    name: 'Ankur Rawat',
    email: 'ankur.rawat@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Associate Manager - CMS',
    department: 'Marketing',
    supervisor_code: 'SQY59542',
    supervisor_name: 'Shivam Chanana',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-chaitali-manjrekar',
    employee_code: 'SBL2609',
    name: 'Chaitali Sudhir Manjrekar',
    email: 'chaitali.manjrekar@squareyards.com',
    level: 'S1',
    location: 'Mumbai',
    designation: 'Marketing Executive',
    department: 'Marketing',
    supervisor_code: 'SBL0105',
    supervisor_name: 'Rohit Rajoriya',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-shweta-tawade',
    employee_code: 'SBL2638',
    name: 'Shweta Tawade',
    email: 'shweta.tawade@squareyards.com',
    level: 'S1',
    location: 'Mumbai',
    designation: 'Marketing Executive',
    department: 'Marketing',
    supervisor_code: 'SBL0105',
    supervisor_name: 'Rohit Rajoriya',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-rishabh-baisoy',
    employee_code: 'SQY42700',
    name: 'Rishabh Baisoy',
    email: 'rishabh.baisoy@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Senior Content Writer',
    department: 'Marketing',
    supervisor_code: 'SDC5595',
    supervisor_name: 'Kunal Sachdeva',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-divya-krishnan',
    employee_code: 'SQY44089',
    name: 'Divya Krishnan',
    email: 'divya.krishnan@squareyards.com',
    level: 'SP&L',
    location: 'Dubai',
    designation: 'Head of Design',
    department: 'Marketing',
    supervisor_code: 'SYME001',
    supervisor_name: 'Kanika Gupta',
    role: 'admin',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-shubham-sandhu',
    employee_code: 'SQY46789',
    name: 'Shubham Sandhu',
    email: 'shubham.sandhu@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Content Writer',
    department: 'Marketing',
    supervisor_code: 'SDC5595',
    supervisor_name: 'Kunal Sachdeva',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-thejus-k-s',
    employee_code: 'SQY46790',
    name: 'Thejus K S',
    email: 'thejus.ks@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Content Writer',
    department: 'Marketing',
    supervisor_code: 'SDC5595',
    supervisor_name: 'Kunal Sachdeva',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-rahul-gautam',
    employee_code: 'SQY51435',
    name: 'Rahul Gautam',
    email: 'rahul.gautam@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Content Writer',
    department: 'Marketing',
    supervisor_code: 'SDC5595',
    supervisor_name: 'Kunal Sachdeva',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-john-antony',
    employee_code: 'SDC6287',
    name: 'John Westly Antony',
    email: 'john.antony@squareyards.com',
    level: 'S1',
    location: 'Dubai',
    designation: 'Sr Videographer and Editor',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-bhavika-modsing',
    employee_code: 'SQY54135',
    name: 'Bhavika Anant Modsing',
    email: 'bhavika.modsing@squareyards.com',
    level: 'S1',
    location: 'Mumbai',
    designation: 'Marketing Executive',
    department: 'Marketing',
    supervisor_code: 'SBL0105',
    supervisor_name: 'Rohit Rajoriya',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-devansh-sharma',
    employee_code: 'SQY54136',
    name: 'Devansh Sharma',
    email: 'devansh.sharma@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Assoc Manager - Google Analytics',
    department: 'Marketing',
    supervisor_code: 'SQY59542',
    supervisor_name: 'Shivam Chanana',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-ritika-tyagi',
    employee_code: 'SQY54370',
    name: 'Ritika Tyagi',
    email: 'ritika.tyagi@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Marketing Executive',
    department: 'Marketing',
    supervisor_code: 'SDC4035',
    supervisor_name: 'Sukhmani',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-bharath-subramani',
    employee_code: 'SQY55352',
    name: 'Bharath Subramani',
    email: 'bharath.subramani@squareyards.com',
    level: 'S1',
    location: 'Dubai',
    designation: 'Sr Executive - Performance Marketing',
    department: 'Marketing',
    supervisor_code: 'SQY44089',
    supervisor_name: 'Divya Krishnan',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-aaryan-sharma',
    employee_code: 'SQY55706',
    name: 'Aaryan Sharma',
    email: 'aaryan.sharma@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Social Media Executive',
    department: 'Marketing',
    supervisor_code: 'SDC4035',
    supervisor_name: 'Sukhmani',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-ankit-rawat',
    employee_code: 'SQY55707',
    name: 'Ankit Rawat',
    email: 'ankit.rawat@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Senior Video Editor',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-prakriti-singh',
    employee_code: 'SQY55708',
    name: 'Prakriti Singh',
    email: 'prakriti.singh@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Social Media Executive',
    department: 'Marketing',
    supervisor_code: 'SDC4035',
    supervisor_name: 'Sukhmani',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-abhay-gupta',
    employee_code: 'SQY55953',
    name: 'Abhay Gupta',
    email: 'abhay.gupta@squareyards.com',
    level: 'S1',
    location: 'Mumbai',
    designation: 'Sr Videographer and Editor',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-namita-aggarwal',
    employee_code: 'SQY55954',
    name: 'Namita Aggarwal',
    email: 'namita.aggarwal@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Senior Graphic Designer',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-sudhir',
    employee_code: 'SQY56101',
    name: 'Sudhir',
    email: 'sudhir@squareyards.com',
    level: 'S2',
    location: 'Gurugram',
    designation: 'Manager Performance Marketing',
    department: 'Marketing',
    supervisor_code: 'SQY56122',
    supervisor_name: 'Paramjeet',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-paramjeet',
    employee_code: 'SQY56122',
    name: 'Paramjeet',
    email: 'paramjeet@squareyards.com',
    level: 'S2',
    location: 'Gurugram',
    designation: 'Manager Performance Marketing',
    department: 'Marketing',
    supervisor_code: 'SQY44089',
    supervisor_name: 'Divya Krishnan',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-raj-gaurav',
    employee_code: 'SIN3939',
    name: 'Raj Gaurav',
    email: 'raj.gaurav@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Intern',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-parth-sharma',
    employee_code: 'SQY56333',
    name: 'Parth Sharma',
    email: 'parth.sharma@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Marketing Lead',
    department: 'Marketing',
    supervisor_code: 'SDC4035',
    supervisor_name: 'Sukhmani',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-garima-banwala',
    employee_code: 'SQY56416',
    name: 'Garima Banwala',
    email: 'garima.banwala@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Senior Graphic Designer',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-akash-bhatt',
    employee_code: 'SQY56773',
    name: 'Akash Bhatt',
    email: 'akash.bhatt@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Video Editor',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-ashish-kumar',
    employee_code: 'SQY56974',
    name: 'Ashish Kumar',
    email: 'ashish.kumar@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Senior Investment Manager',
    department: 'Marketing',
    supervisor_code: 'SDC4035',
    supervisor_name: 'Sukhmani',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-piyush-sharma',
    employee_code: 'SQY57146',
    name: 'Piyush Sharma',
    email: 'piyush.sharma@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Marketing Executive',
    department: 'Marketing',
    supervisor_code: 'SQY56333',
    supervisor_name: 'Parth Sharma',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-rishabh-singh',
    employee_code: 'SQY57180',
    name: 'Rishabh Singh',
    email: 'rishabh.singh@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Graphic Designer',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-sidharth-bharti',
    employee_code: 'SQY57973',
    name: 'Sidharth Bharti',
    email: 'sidharth.bharti@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Graphic Designer',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-pranjal-sapra',
    employee_code: 'SQY58633',
    name: 'Pranjal Sapra',
    email: 'pranjal.sapra@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Senior Content Writer',
    department: 'Marketing',
    supervisor_code: 'SDC4035',
    supervisor_name: 'Sukhmani',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-mitesh-singh',
    employee_code: 'SQY58651',
    name: 'Mitesh Kumar Singh',
    email: 'mitesh.singh@squareyards.com',
    level: 'S2',
    location: 'Gurugram',
    designation: 'AGM - SEO',
    department: 'Marketing',
    supervisor_code: 'SQY59542',
    supervisor_name: 'Shivam Chanana',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-abheet-chawla',
    employee_code: 'SQY58858',
    name: 'Abheet Chawla',
    email: 'abheet.chawla@squareyards.com',
    level: 'S2',
    location: 'Gurugram',
    designation: 'Content Manager',
    department: 'Marketing',
    supervisor_code: 'SDC5595',
    supervisor_name: 'Kunal Sachdeva',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-rahul-chatterjee',
    employee_code: 'SQY58916',
    name: 'Rahul Chatterjee',
    email: 'rahul.chatterjee@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Video Editor',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-sakshi-saxena',
    employee_code: 'SDC6596',
    name: 'Sakshi Saxena',
    email: 'sakshi.saxena@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Sr Manager: Research & Media',
    department: 'Marketing',
    supervisor_code: 'SQY59401',
    supervisor_name: 'Sunita Mishra',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-abigail-venessa',
    employee_code: 'SQY59196',
    name: 'Abigail Venessa Simmons',
    email: 'abigail.venessa@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Content Writer',
    department: 'Marketing',
    supervisor_code: 'SDC5595',
    supervisor_name: 'Kunal Sachdeva',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-drishti-katyal',
    employee_code: 'SQY59215',
    name: 'Drishti Katyal',
    email: 'drishti.katyal@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Content Writer',
    department: 'Marketing',
    supervisor_code: 'SDC5595',
    supervisor_name: 'Kunal Sachdeva',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-sunita-mishra',
    employee_code: 'SQY59401',
    name: 'Sunita Mishra',
    email: 'sunita.mishra@squareyards.com',
    level: 'S3',
    location: 'Gurugram',
    designation: 'Content Strategy Head',
    department: 'Marketing',
    supervisor_code: 'SQY44089',
    supervisor_name: 'Divya Krishnan',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-muskan-shafi',
    employee_code: 'SQY59407',
    name: 'Muskan Shafi',
    email: 'muskan.shafi@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Senior Content Writer',
    department: 'Marketing',
    supervisor_code: 'SDC5595',
    supervisor_name: 'Kunal Sachdeva',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-shivam-chanana',
    employee_code: 'SQY59542',
    name: 'Shivam Chanana',
    email: 'shivam.chanana@squareyards.com',
    level: 'S2',
    location: 'Gurugram',
    designation: 'AGM - SEO',
    department: 'Marketing',
    supervisor_code: 'SQY44089',
    supervisor_name: 'Divya Krishnan',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-diva-bindal',
    employee_code: 'SIN3981',
    name: 'Diva Bindal',
    email: 'diva.bindal@squareyards.com',
    level: 'SE',
    location: 'Gurugram',
    designation: 'Intern',
    department: 'Marketing',
    supervisor_code: 'SQY60797',
    supervisor_name: 'Dhruv Thakur',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-aditi-arora',
    employee_code: 'SQY59715',
    name: 'Aditi Arora',
    email: 'aditi.arora@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Marketing Executive',
    department: 'Marketing',
    supervisor_code: 'SQY60797',
    supervisor_name: 'Dhruv Thakur',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-jyotsna-chudji',
    employee_code: 'SQY59917',
    name: 'Jyotsna Santosh Chudji',
    email: 'jyotsna.chudji@squareyards.com',
    level: 'S0',
    location: 'Mumbai',
    designation: 'Marketing Executive',
    department: 'Marketing',
    supervisor_code: 'SBL0105',
    supervisor_name: 'Rohit Rajoriya',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-tanishka-jamwal',
    employee_code: 'SQY59928',
    name: 'Tanishka Jamwal',
    email: 'tanishka.jamwal@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Marketing Executive',
    department: 'Marketing',
    supervisor_code: 'SDC5405',
    supervisor_name: 'Ashish Singh',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-aditya-mishra',
    employee_code: 'SIN3991',
    name: 'Aditya Kumar Mishra',
    email: 'aditya.mishra@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'SEO Intern',
    department: 'Marketing',
    supervisor_code: 'SQY59542',
    supervisor_name: 'Shivam Chanana',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-chinmay-gaur',
    employee_code: 'SQY60167',
    name: 'Chinmay Gaur',
    email: 'chinmay.gaur@squareyards.com',
    level: 'S1',
    location: 'Gurugram',
    designation: 'Generative Engine Optimization',
    department: 'Marketing',
    supervisor_code: 'SQY44089',
    supervisor_name: 'Divya Krishnan',
    role: 'designer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-prateek-jain',
    employee_code: 'SIN3994',
    name: 'Prateek Jain',
    email: 'prateek.jain@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Intern',
    department: 'Marketing',
    supervisor_code: 'SQY59542',
    supervisor_name: 'Shivam Chanana',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-riddhi-chatterji',
    employee_code: 'SQY60210',
    name: 'Riddhi Chatterji',
    email: 'riddhi.chatterji@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Content Writer',
    department: 'Marketing',
    supervisor_code: 'SQY59401',
    supervisor_name: 'Sunita Mishra',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-abhilasa-bhattacharya',
    employee_code: 'SQY60413',
    name: 'Abhilasa Bhattacharya',
    email: 'abhilasa.bhattacharya@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Senior Marketing Strategist',
    department: 'Marketing',
    supervisor_code: 'SDC4035',
    supervisor_name: 'Sukhmani',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-simran-shankar',
    employee_code: 'SQY60437',
    name: 'Simran Shankar',
    email: 'simran.shankar@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Marketing Executive',
    department: 'Marketing',
    supervisor_code: 'SDC4035',
    supervisor_name: 'Sukhmani',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-vishesh-paliwal',
    employee_code: 'SQY60597',
    name: 'Vishesh Paliwal',
    email: 'vishesh.paliwal@squareyards.com',
    level: 'S2',
    location: 'Gurugram',
    designation: 'Marketing Lead',
    department: 'Marketing',
    supervisor_code: 'SQY59542',
    supervisor_name: 'Shivam Chanana',
    role: 'manager',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-dhruv-thakur',
    employee_code: 'SQY60797',
    name: 'Dhruv Thakur',
    email: 'dhruv.thakur@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Copy Lead',
    department: 'Marketing',
    supervisor_code: 'SDC4035',
    supervisor_name: 'Sukhmani',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-harshita-bansal',
    employee_code: 'SIN4006',
    name: 'Harshita Bansal',
    email: 'harshita.bansal@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Intern',
    department: 'Marketing',
    supervisor_code: 'SQY59542',
    supervisor_name: 'Shivam Chanana',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-himani-rajput',
    employee_code: 'SQY60844',
    name: 'Himani Rajput',
    email: 'himani.rajput@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Video Editor',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-amit-kumar',
    employee_code: 'SQY60845',
    name: 'Amit Kumar',
    email: 'amit.kumar@squareyards.com',
    level: 'S0',
    location: 'Gurugram',
    designation: 'Video Editor',
    department: 'Marketing',
    supervisor_code: 'SBL0055',
    supervisor_name: 'Lalit Bhardwaj',
    role: 'viewer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const ITEMS_PER_PAGE = 20;

type SortKey = 'name' | 'employee_code' | 'designation' | 'location' | 'level' | 'role' | 'is_active';
type SortOrder = 'asc' | 'desc';

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>(ALL_USERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter and search
  const filteredUsers = useMemo(() => {
    let result = users;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (user) =>
          user.name.toLowerCase().includes(term) ||
          user.email?.toLowerCase().includes(term) ||
          user.designation?.toLowerCase().includes(term)
      );
    }

    // Role filter
    if (selectedRole !== 'all') {
      result = result.filter((user) => user.role === selectedRole);
    }

    // Location filter
    if (selectedLocation !== 'all') {
      result = result.filter((user) => user.location === selectedLocation);
    }

    // Sort
    result.sort((a, b) => {
      const aVal: any = a[sortKey];
      const bVal: any = b[sortKey];

      if (aVal === undefined || bVal === undefined) return 0;

      let comparison = 0;
      if (typeof aVal === 'string') {
        comparison = aVal.localeCompare(bVal as string);
      } else if (typeof aVal === 'boolean') {
        comparison = (aVal ? 1 : 0) - (bVal ? 1 : 0);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [users, searchTerm, selectedRole, selectedLocation, sortKey, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Stats calculations
  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.is_active).length,
      managers: users.filter(
        (u) => u.role === 'manager' || u.role === 'admin'
      ).length,
      designers: users.filter(
        (u) => u.role === 'designer'
      ).length,
    };
  }, [users]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleSaveUser = (updatedUser: User) => {
    setUsers(users.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleToggleActive = (user: User) => {
    const updated = { ...user, is_active: !user.is_active };
    handleSaveUser(updated);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'gb-badge gb-badge-red';
      case 'manager':
        return 'gb-badge gb-badge-blue';
      case 'designer':
        return 'gb-badge gb-badge-green';
      case 'viewer':
        return 'gb-badge gb-badge-gray';
    }
  };

  const getAvatarColor = (role: UserRole) => {
    // This is now handled inline with CSS variables and gradients
    return '';
  };

  const SortIndicator = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  const locations = ['all', ...Array.from(new Set(users.map((u) => u.location).filter((loc) => loc !== undefined)))];


  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Page Header */}
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">User Management</h1>
          <p className="gb-page-description">
            Manage permissions, roles, and access for the marketing team.
          </p>
        </div>
        <button className="gb-btn gb-btn-primary">
          <UserPlus className="w-4 h-4" />
          Invite User
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="gb-stat-card">
          <div className="gb-stat-label">Total Users</div>
          <div className="gb-stat-value">{stats.total}</div>
        </div>
        <div className="gb-stat-card">
          <div className="gb-stat-label">Active</div>
          <div className="gb-stat-value" style={{ color: 'var(--success)' }}>
            {stats.active}
          </div>
        </div>
        <div className="gb-stat-card">
          <div className="gb-stat-label">Admins</div>
          <div className="gb-stat-value" style={{ color: 'var(--error)' }}>
            {users.filter((u) => u.role === 'admin').length}
          </div>
        </div>
        <div className="gb-stat-card">
          <div className="gb-stat-label">Managers</div>
          <div className="gb-stat-value" style={{ color: 'var(--accent)' }}>
            {stats.managers}
          </div>
        </div>
        <div className="gb-stat-card">
          <div className="gb-stat-label">Designers</div>
          <div className="gb-stat-value" style={{ color: 'var(--success)' }}>
            {stats.designers}
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="gb-card" style={{ padding: '20px', marginBottom: '24px' }}>
        {/* Search Bar */}
        <div className="gb-search" style={{ width: '320px', marginBottom: '16px' }}>
          <Search className="w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name, email, or designation..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Role Filters - Using gb-tabs pattern */}
        <div className="flex gap-2 flex-wrap mb-4">
          {(['all', 'admin', 'manager', 'designer', 'viewer'] as const).map(
            (role) => (
              <button
                key={role}
                onClick={() => {
                  setSelectedRole(role);
                  setCurrentPage(1);
                }}
                className={`gb-btn ${
                  selectedRole === role
                    ? 'gb-btn-primary'
                    : 'gb-btn-secondary'
                }`}
              >
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            )
          )}
        </div>

        {/* Location Filters */}
        <div className="flex gap-2 flex-wrap">
          {locations.map((location) => (
            <button
              key={location}
              onClick={() => {
                setSelectedLocation(location);
                setCurrentPage(1);
              }}
              className={`gb-btn ${
                selectedLocation === location
                  ? 'gb-btn-primary'
                  : 'gb-btn-secondary'
              }`}
            >
              {location === 'all'
                ? 'All Locations'
                : location}
            </button>
          ))}
        </div>
      </div>

      {/* Results Info */}
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Showing {paginatedUsers.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} to{' '}
        {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of{' '}
        {filteredUsers.length} users
      </div>

      {/* Users Table */}
      <div className="gb-card overflow-x-auto mb-6">
        <table className="gb-table">
          <thead>
            <tr>
              <th>
                <button
                  onClick={() => handleSort('name')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  Name
                  <SortIndicator column="name" />
                </button>
              </th>
              <th>
                <button
                  onClick={() => handleSort('employee_code')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  Code
                  <SortIndicator column="employee_code" />
                </button>
              </th>
              <th>
                <button
                  onClick={() => handleSort('designation')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  Designation
                  <SortIndicator column="designation" />
                </button>
              </th>
              <th>
                <button
                  onClick={() => handleSort('location')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  Location
                  <SortIndicator column="location" />
                </button>
              </th>
              <th>
                <button
                  onClick={() => handleSort('level')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  Level
                  <SortIndicator column="level" />
                </button>
              </th>
              <th>
                <button
                  onClick={() => handleSort('role')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  Role
                  <SortIndicator column="role" />
                </button>
              </th>
              <th>Supervisor</th>
              <th>
                <button
                  onClick={() => handleSort('is_active')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  Status
                  <SortIndicator column="is_active" />
                </button>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-light)',
                        color: 'var(--accent-text)',
                        border: '1px solid var(--border)',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {getInitials(user.name)}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {user.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {user.employee_code}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {user.designation}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {user.location}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {user.level === 'SP&L' ? (
                      <span className="gb-badge gb-badge-blue">
                        SP&L
                      </span>
                    ) : (
                      user.level
                    )}
                  </span>
                </td>
                <td>
                  <span className={getRoleColor(user.role)}>
                    {user.role}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {user.supervisor_name || '-'}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => handleToggleActive(user)}
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      height: '24px',
                      width: '44px',
                      alignItems: 'center',
                      borderRadius: '12px',
                      transition: 'background-color 200ms ease',
                      backgroundColor: user.is_active ? 'var(--success)' : 'var(--text-faint)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        display: 'block',
                        height: '18px',
                        width: '18px',
                        transform: user.is_active ? 'translateX(22px)' : 'translateX(3px)',
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        transition: 'transform 200ms ease',
                      }}
                    />
                  </button>
                </td>
                <td>
                  <button
                    onClick={() => handleEditUser(user)}
                    className="gb-btn gb-btn-primary"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Page {currentPage} of {totalPages}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="gb-btn gb-btn-secondary"
          >
            Previous
          </button>
          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            const pageNum = currentPage <= 3 ? i + 1 : Math.max(1, currentPage - 2) + i;
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={currentPage === pageNum ? 'gb-btn gb-btn-primary' : 'gb-btn gb-btn-secondary'}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="gb-btn gb-btn-secondary"
          >
            Next
          </button>
        </div>
      </div>

      {/* Permission Management Section */}
      <div className="gb-card" style={{ padding: '24px' }}>
        <h3 className="gb-section-title" style={{ marginBottom: '20px' }}>
          Role Permissions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-tertiary)' }}>
            <div style={{ marginBottom: '8px' }}>
              <span className="gb-badge gb-badge-red">Admin</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Full access to all features, user management, and settings
            </p>
          </div>
          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-tertiary)' }}>
            <div style={{ marginBottom: '8px' }}>
              <span className="gb-badge gb-badge-blue">Manager</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Can assign tasks, view all team analytics, and manage pipeline
            </p>
          </div>
          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-tertiary)' }}>
            <div style={{ marginBottom: '8px' }}>
              <span className="gb-badge gb-badge-green">Designer</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Can view assigned tasks, update status, and upload deliverables
            </p>
          </div>
          <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-tertiary)' }}>
            <div style={{ marginBottom: '8px' }}>
              <span className="gb-badge gb-badge-gray">Viewer</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Read-only access to dashboards and reports
            </p>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingUser(null);
          }}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
}
