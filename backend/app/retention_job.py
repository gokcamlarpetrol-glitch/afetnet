#!/usr/bin/env python3
"""
Data Retention Job
Automated cleanup of old records with configurable retention periods
"""

import sqlite3
import schedule
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RetentionJob:
    def __init__(self, db_path: str = 'afetnet_data.db'):
        self.db_path = db_path
        self.retention_config = {
            'help_requests': 30,      # days
            'resource_posts': 30,     # days
            'damage_reports': 30,     # days
            'status_pings': 7,        # days
            'telemetry_data': 30,     # days
            'session_logs': 7,        # days
        }
        
    def get_db_connection(self):
        """Get database connection"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def cleanup_table(self, table_name: str, days_to_keep: int) -> int:
        """Clean up old records from a specific table"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # Calculate cutoff date
            cutoff_date = datetime.now() - timedelta(days=days_to_keep)
            cutoff_timestamp = int(cutoff_date.timestamp() * 1000)
            
            # Count records to be deleted
            cursor.execute(f'SELECT COUNT(*) as count FROM {table_name} WHERE ts < ?', (cutoff_timestamp,))
            count_before = cursor.fetchone()['count']
            
            # Delete old records
            cursor.execute(f'DELETE FROM {table_name} WHERE ts < ?', (cutoff_timestamp,))
            deleted_count = cursor.rowcount
            
            conn.commit()
            conn.close()
            
            logger.info(f'Cleaned up {deleted_count} records from {table_name} (older than {days_to_keep} days)')
            return deleted_count
            
        except Exception as e:
            logger.error(f'Failed to cleanup {table_name}: {str(e)}')
            return 0
    
    def cleanup_all_tables(self) -> Dict[str, int]:
        """Clean up all tables according to retention policy"""
        results = {}
        total_deleted = 0
        
        logger.info('Starting data retention cleanup...')
        
        for table_name, days_to_keep in self.retention_config.items():
            try:
                deleted_count = self.cleanup_table(table_name, days_to_keep)
                results[table_name] = deleted_count
                total_deleted += deleted_count
            except Exception as e:
                logger.error(f'Failed to cleanup {table_name}: {str(e)}')
                results[table_name] = 0
        
        logger.info(f'Retention cleanup completed: {total_deleted} total records deleted')
        return results
    
    def get_retention_stats(self) -> Dict[str, Any]:
        """Get statistics about data retention"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            stats = {
                'tables': {},
                'total_records': 0,
                'oldest_record': None,
                'newest_record': None,
                'retention_config': self.retention_config
            }
            
            for table_name in self.retention_config.keys():
                try:
                    # Count total records
                    cursor.execute(f'SELECT COUNT(*) as count FROM {table_name}')
                    count = cursor.fetchone()['count']
                    
                    # Get oldest and newest timestamps
                    cursor.execute(f'SELECT MIN(ts) as oldest, MAX(ts) as newest FROM {table_name}')
                    result = cursor.fetchone()
                    
                    stats['tables'][table_name] = {
                        'count': count,
                        'oldest_ts': result['oldest'],
                        'newest_ts': result['newest'],
                        'retention_days': self.retention_config[table_name]
                    }
                    
                    stats['total_records'] += count
                    
                    # Update global oldest/newest
                    if result['oldest'] and (not stats['oldest_record'] or result['oldest'] < stats['oldest_record']):
                        stats['oldest_record'] = result['oldest']
                    
                    if result['newest'] and (not stats['newest_record'] or result['newest'] > stats['newest_record']):
                        stats['newest_record'] = result['newest']
                        
                except sqlite3.OperationalError:
                    # Table doesn't exist
                    stats['tables'][table_name] = {
                        'count': 0,
                        'oldest_ts': None,
                        'newest_ts': None,
                        'retention_days': self.retention_config[table_name]
                    }
            
            conn.close()
            return stats
            
        except Exception as e:
            logger.error(f'Failed to get retention stats: {str(e)}')
            return {}
    
    def update_retention_config(self, new_config: Dict[str, int]):
        """Update retention configuration"""
        self.retention_config.update(new_config)
        logger.info(f'Retention config updated: {self.retention_config}')
    
    def schedule_daily_cleanup(self, hour: int = 2, minute: int = 0):
        """Schedule daily cleanup job"""
        schedule.every().day.at(f'{hour:02d}:{minute:02d}').do(self.cleanup_all_tables)
        logger.info(f'Scheduled daily cleanup at {hour:02d}:{minute:02d}')
    
    def run_scheduled_jobs(self):
        """Run all scheduled jobs"""
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    
    def manual_cleanup(self, table_name: str = None, days: int = None) -> Dict[str, int]:
        """Run manual cleanup"""
        if table_name and days:
            # Clean specific table
            deleted_count = self.cleanup_table(table_name, days)
            return {table_name: deleted_count}
        else:
            # Clean all tables
            return self.cleanup_all_tables()

# CLI interface
if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Data Retention Job')
    parser.add_argument('--cleanup', action='store_true', help='Run cleanup now')
    parser.add_argument('--stats', action='store_true', help='Show retention stats')
    parser.add_argument('--schedule', action='store_true', help='Run scheduled jobs')
    parser.add_argument('--table', type=str, help='Specific table to clean')
    parser.add_argument('--days', type=int, help='Days to keep (for specific table)')
    parser.add_argument('--hour', type=int, default=2, help='Hour for scheduled cleanup')
    parser.add_argument('--minute', type=int, default=0, help='Minute for scheduled cleanup')
    
    args = parser.parse_args()
    
    retention_job = RetentionJob()
    
    if args.cleanup:
        if args.table and args.days:
            results = retention_job.manual_cleanup(args.table, args.days)
        else:
            results = retention_job.manual_cleanup()
        print(f'Cleanup results: {results}')
    
    if args.stats:
        stats = retention_job.get_retention_stats()
        print(f'Retention stats: {stats}')
    
    if args.schedule:
        retention_job.schedule_daily_cleanup(args.hour, args.minute)
        print(f'Starting scheduled retention jobs...')
        retention_job.run_scheduled_jobs()
