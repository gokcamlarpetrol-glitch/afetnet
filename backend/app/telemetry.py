#!/usr/bin/env python3
"""
Telemetry Backend API
Handles minimal telemetry data collection and analysis
"""

from flask import Flask, request, jsonify
from flask_httpauth import HTTPBasicAuth
import sqlite3
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List
import uuid

app = Flask(__name__)
auth = HTTPBasicAuth()

# Simple admin credentials (in production, use proper authentication)
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'afetnet2024'

@auth.verify_password
def verify_password(username, password):
    return username == ADMIN_USERNAME and password == ADMIN_PASSWORD

def init_telemetry_db():
    """Initialize telemetry database"""
    conn = sqlite3.connect('telemetry.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetry_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            event_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetry_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            date TEXT NOT NULL,
            help_requests INTEGER DEFAULT 0,
            resource_posts INTEGER DEFAULT 0,
            damage_reports INTEGER DEFAULT 0,
            p2p_messages_sent INTEGER DEFAULT 0,
            p2p_messages_received INTEGER DEFAULT 0,
            sms_sent INTEGER DEFAULT 0,
            shake_detections INTEGER DEFAULT 0,
            app_launches INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(device_id, date)
        )
    ''')
    
    # Create indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_device_id ON telemetry_data (device_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON telemetry_data (timestamp)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_event_type ON telemetry_data (event_type)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_device_date ON telemetry_stats (device_id, date)')
    
    conn.commit()
    conn.close()

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect('telemetry.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/telemetry/collect', methods=['POST'])
def collect_telemetry():
    """Collect telemetry data from client"""
    try:
        data = request.get_json()
        
        required_fields = ['device_id', 'session_id', 'timestamp', 'event_type']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Validate data
        if not isinstance(data['timestamp'], (int, float)):
            return jsonify({'error': 'Invalid timestamp'}), 400
        
        # Store telemetry data
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO telemetry_data (
                device_id, session_id, timestamp, event_type, event_data
            ) VALUES (?, ?, ?, ?, ?)
        ''', (
            data['device_id'],
            data['session_id'],
            data['timestamp'],
            data['event_type'],
            json.dumps(data.get('event_data', {}))
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Telemetry data collected'
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to collect telemetry: {str(e)}'
        }), 500

@app.route('/api/telemetry/stats', methods=['POST'])
def submit_stats():
    """Submit aggregated statistics"""
    try:
        data = request.get_json()
        
        required_fields = ['device_id', 'stats']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'error': f'Missing required field: {field}'
                }), 400
        
        stats = data['stats']
        device_id = data['device_id']
        
        # Get current date
        current_date = datetime.now().strftime('%Y-%m-%d')
        
        # Store or update stats
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO telemetry_stats (
                device_id, date, help_requests, resource_posts, damage_reports,
                p2p_messages_sent, p2p_messages_received, sms_sent,
                shake_detections, app_launches, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (
            device_id,
            current_date,
            stats.get('helpRequestsCreated', 0),
            stats.get('resourcePostsCreated', 0),
            stats.get('damageReportsCreated', 0),
            stats.get('p2pMessagesSent', 0),
            stats.get('p2pMessagesReceived', 0),
            stats.get('smsSent', 0),
            stats.get('shakeDetections', 0),
            stats.get('appLaunches', 0)
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Statistics submitted'
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to submit stats: {str(e)}'
        }), 500

@app.route('/api/telemetry/analytics', methods=['GET'])
@auth.login_required
def get_analytics():
    """Get telemetry analytics (admin only)"""
    try:
        # Parse query parameters
        days = int(request.args.get('days', 7))
        device_id = request.args.get('device_id')
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Build query
        query = '''
            SELECT 
                date,
                SUM(help_requests) as total_help_requests,
                SUM(resource_posts) as total_resource_posts,
                SUM(damage_reports) as total_damage_reports,
                SUM(p2p_messages_sent) as total_p2p_sent,
                SUM(p2p_messages_received) as total_p2p_received,
                SUM(sms_sent) as total_sms_sent,
                SUM(shake_detections) as total_shake_detections,
                SUM(app_launches) as total_app_launches,
                COUNT(DISTINCT device_id) as unique_devices
            FROM telemetry_stats 
            WHERE date >= ? AND date <= ?
        '''
        
        params = [start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')]
        
        if device_id:
            query += ' AND device_id = ?'
            params.append(device_id)
        
        query += ' GROUP BY date ORDER BY date DESC'
        
        cursor.execute(query, params)
        daily_stats = [dict(row) for row in cursor.fetchall()]
        
        # Get overall totals
        cursor.execute('''
            SELECT 
                SUM(help_requests) as total_help_requests,
                SUM(resource_posts) as total_resource_posts,
                SUM(damage_reports) as total_damage_reports,
                SUM(p2p_messages_sent) as total_p2p_sent,
                SUM(p2p_messages_received) as total_p2p_received,
                SUM(sms_sent) as total_sms_sent,
                SUM(shake_detections) as total_shake_detections,
                SUM(app_launches) as total_app_launches,
                COUNT(DISTINCT device_id) as unique_devices
            FROM telemetry_stats 
            WHERE date >= ? AND date <= ?
        ''', [start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')])
        
        totals = dict(cursor.fetchone())
        
        # Get device activity
        cursor.execute('''
            SELECT device_id, COUNT(*) as active_days
            FROM telemetry_stats 
            WHERE date >= ? AND date <= ?
            GROUP BY device_id
            ORDER BY active_days DESC
        ''', [start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')])
        
        device_activity = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        return jsonify({
            'success': True,
            'period': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'days': days
            },
            'totals': totals,
            'daily_stats': daily_stats,
            'device_activity': device_activity[:10]  # Top 10 most active devices
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to get analytics: {str(e)}'
        }), 500

@app.route('/api/telemetry/events', methods=['GET'])
@auth.login_required
def get_events():
    """Get telemetry events (admin only)"""
    try:
        # Parse query parameters
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        event_type = request.args.get('event_type')
        device_id = request.args.get('device_id')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Build query
        query = '''
            SELECT device_id, session_id, timestamp, event_type, event_data, created_at
            FROM telemetry_data 
            WHERE 1=1
        '''
        
        params = []
        
        if event_type:
            query += ' AND event_type = ?'
            params.append(event_type)
        
        if device_id:
            query += ' AND device_id = ?'
            params.append(device_id)
        
        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        events = [dict(row) for row in cursor.fetchall()]
        
        # Parse event_data JSON
        for event in events:
            try:
                event['event_data'] = json.loads(event['event_data']) if event['event_data'] else {}
            except json.JSONDecodeError:
                event['event_data'] = {}
        
        conn.close()
        
        return jsonify({
            'success': True,
            'events': events,
            'count': len(events)
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to get events: {str(e)}'
        }), 500

@app.route('/api/telemetry/cleanup', methods=['POST'])
@auth.login_required
def cleanup_telemetry():
    """Clean up old telemetry data (admin only)"""
    try:
        data = request.get_json()
        days_to_keep = data.get('days_to_keep', 30)
        
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)
        cutoff_timestamp = int(cutoff_date.timestamp() * 1000)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Clean up telemetry_data
        cursor.execute('DELETE FROM telemetry_data WHERE timestamp < ?', (cutoff_timestamp,))
        events_deleted = cursor.rowcount
        
        # Clean up old telemetry_stats
        cursor.execute('DELETE FROM telemetry_stats WHERE date < ?', (cutoff_date.strftime('%Y-%m-%d')))
        stats_deleted = cursor.rowcount
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'deleted': {
                'events': events_deleted,
                'stats': stats_deleted,
                'total': events_deleted + stats_deleted
            },
            'message': f'Cleaned up data older than {days_to_keep} days'
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to cleanup telemetry: {str(e)}'
        }), 500

if __name__ == '__main__':
    init_telemetry_db()
    app.run(debug=True, host='0.0.0.0', port=5003)
