#!/usr/bin/env python3
"""
Data Export Backend API
Admin-only data export with privacy masking
"""

from flask import Flask, request, jsonify, send_file
from flask_httpauth import HTTPBasicAuth
import sqlite3
import csv
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List
import random
import math

app = Flask(__name__)
auth = HTTPBasicAuth()

# Simple admin credentials (in production, use proper authentication)
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'afetnet2024'

@auth.verify_password
def verify_password(username, password):
    return username == ADMIN_USERNAME and password == ADMIN_PASSWORD

def jitter_location(lat: float, lon: float, radius_meters: int = 100) -> tuple:
    """Add random jitter to location coordinates for privacy"""
    # Convert radius from meters to approximate degrees
    lat_radius = radius_meters / 111000  # Rough conversion
    lon_radius = radius_meters / (111000 * abs(math.cos(math.radians(lat))))
    
    # Generate random jitter within radius
    random_lat = (random.random() - 0.5) * 2 * lat_radius
    random_lon = (random.random() - 0.5) * 2 * lon_radius
    
    return lat + random_lat, lon + random_lon

def mask_phone_number(phone: str) -> str:
    """Mask phone number for privacy"""
    if not phone or len(phone) < 6:
        return '***'
    
    country_code = phone[:3] if len(phone) > 6 else phone[:2]
    last_digits = phone[-3:]
    return f"{country_code}****{last_digits}"

def get_db_connection():
    """Get database connection"""
    # This would connect to the actual database
    # For demo purposes, using a simple SQLite connection
    conn = sqlite3.connect('afetnet_data.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/export/help-requests', methods=['GET'])
@auth.login_required
def export_help_requests():
    """Export help requests with privacy masking"""
    try:
        # Parse query parameters
        format_type = request.args.get('format', 'csv')
        time_range = request.args.get('time_range', 'all')  # 24h, 72h, all
        include_location = request.args.get('include_location', 'true').lower() == 'true'
        include_notes = request.args.get('include_notes', 'false').lower() == 'true'
        jitter_radius = int(request.args.get('jitter_radius', '100'))
        
        # Calculate cutoff time
        cutoff_time = 0
        if time_range == '24h':
            cutoff_time = int((datetime.now() - timedelta(hours=24)).timestamp() * 1000)
        elif time_range == '72h':
            cutoff_time = int((datetime.now() - timedelta(hours=72)).timestamp() * 1000)
        
        # Query help requests
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = 'SELECT * FROM help_requests WHERE ts >= ? ORDER BY ts DESC'
        cursor.execute(query, (cutoff_time,))
        help_requests = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        # Apply privacy masking
        masked_data = []
        for request in help_requests:
            masked_request = {
                'id': request['id'],
                'timestamp': request['ts'],
                'priority': request['priority'],
                'under_rubble': request['under_rubble'],
                'injured': request['injured'],
                'people_count': request['people_count'],
                'battery': request['battery'],
                'anonymity': request['anonymity'],
                'ttl': request['ttl'],
                'delivered': request['delivered'],
                'hops': request['hops'],
                'source': request['source'],
            }
            
            if include_location:
                lat, lon = jitter_location(
                    request['lat'],
                    request['lon'],
                    jitter_radius
                )
                masked_request['latitude'] = lat
                masked_request['longitude'] = lon
                masked_request['accuracy'] = request['accuracy']
            
            if include_notes:
                masked_request['note'] = request['note']
            
            masked_data.append(masked_request)
        
        # Generate file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'help_requests_{time_range}_{timestamp}'
        
        if format_type == 'csv':
            return generate_csv_response(masked_data, filename)
        elif format_type == 'geojson':
            return generate_geojson_response(masked_data, filename)
        else:
            return jsonify({'error': 'Invalid format. Use csv or geojson'}), 400
            
    except Exception as e:
        return jsonify({'error': f'Export failed: {str(e)}'}), 500

@app.route('/api/export/resource-posts', methods=['GET'])
@auth.login_required
def export_resource_posts():
    """Export resource posts with privacy masking"""
    try:
        # Parse query parameters
        format_type = request.args.get('format', 'csv')
        time_range = request.args.get('time_range', 'all')
        include_location = request.args.get('include_location', 'true').lower() == 'true'
        include_notes = request.args.get('include_notes', 'false').lower() == 'true'
        jitter_radius = int(request.args.get('jitter_radius', '100'))
        
        # Calculate cutoff time
        cutoff_time = 0
        if time_range == '24h':
            cutoff_time = int((datetime.now() - timedelta(hours=24)).timestamp() * 1000)
        elif time_range == '72h':
            cutoff_time = int((datetime.now() - timedelta(hours=72)).timestamp() * 1000)
        
        # Query resource posts
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = 'SELECT * FROM resource_posts WHERE ts >= ? ORDER BY ts DESC'
        cursor.execute(query, (cutoff_time,))
        resource_posts = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        # Apply privacy masking
        masked_data = []
        for post in resource_posts:
            masked_post = {
                'id': post['id'],
                'timestamp': post['ts'],
                'type': post['type'],
                'qty': post['qty'],
            }
            
            if include_location:
                lat, lon = jitter_location(
                    post['lat'],
                    post['lon'],
                    jitter_radius
                )
                masked_post['latitude'] = lat
                masked_post['longitude'] = lon
            
            if include_notes:
                masked_post['description'] = post['description']
            
            masked_data.append(masked_post)
        
        # Generate file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'resource_posts_{time_range}_{timestamp}'
        
        if format_type == 'csv':
            return generate_csv_response(masked_data, filename)
        elif format_type == 'geojson':
            return generate_geojson_response(masked_data, filename)
        else:
            return jsonify({'error': 'Invalid format. Use csv or geojson'}), 400
            
    except Exception as e:
        return jsonify({'error': f'Export failed: {str(e)}'}), 500

@app.route('/api/export/damage-reports', methods=['GET'])
@auth.login_required
def export_damage_reports():
    """Export damage reports with privacy masking"""
    try:
        # Parse query parameters
        format_type = request.args.get('format', 'csv')
        time_range = request.args.get('time_range', 'all')
        include_location = request.args.get('include_location', 'true').lower() == 'true'
        include_notes = request.args.get('include_notes', 'false').lower() == 'true'
        jitter_radius = int(request.args.get('jitter_radius', '100'))
        
        # Calculate cutoff time
        cutoff_time = 0
        if time_range == '24h':
            cutoff_time = int((datetime.now() - timedelta(hours=24)).timestamp() * 1000)
        elif time_range == '72h':
            cutoff_time = int((datetime.now() - timedelta(hours=72)).timestamp() * 1000)
        
        # Query damage reports
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = 'SELECT * FROM damage_reports WHERE ts >= ? ORDER BY ts DESC'
        cursor.execute(query, (cutoff_time,))
        damage_reports = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        # Apply privacy masking
        masked_data = []
        for report in damage_reports:
            masked_report = {
                'id': report['id'],
                'timestamp': report['ts'],
                'type': report['type'],
                'severity': report['severity'],
                'confirmed': report['confirmed'],
                'delivered': report['delivered'],
                'source': report['source'],
            }
            
            if include_location:
                lat, lon = jitter_location(
                    report['lat'],
                    report['lon'],
                    jitter_radius
                )
                masked_report['latitude'] = lat
                masked_report['longitude'] = lon
                masked_report['accuracy'] = report['accuracy']
            
            if include_notes:
                masked_report['description'] = report['description']
                masked_report['reporter_name'] = report['reporter_name']
                if report['reporter_phone']:
                    masked_report['reporter_phone'] = mask_phone_number(report['reporter_phone'])
            
            masked_data.append(masked_report)
        
        # Generate file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'damage_reports_{time_range}_{timestamp}'
        
        if format_type == 'csv':
            return generate_csv_response(masked_data, filename)
        elif format_type == 'geojson':
            return generate_geojson_response(masked_data, filename)
        else:
            return jsonify({'error': 'Invalid format. Use csv or geojson'}), 400
            
    except Exception as e:
        return jsonify({'error': f'Export failed: {str(e)}'}), 500

@app.route('/api/export/all', methods=['GET'])
@auth.login_required
def export_all_data():
    """Export all data types as a zip file"""
    try:
        # This would create a zip file with all data types
        # For now, return a summary
        return jsonify({
            'message': 'All data export not yet implemented',
            'available_endpoints': [
                '/api/export/help-requests',
                '/api/export/resource-posts',
                '/api/export/damage-reports'
            ]
        })
    except Exception as e:
        return jsonify({'error': f'Export failed: {str(e)}'}), 500

def generate_csv_response(data: List[Dict], filename: str):
    """Generate CSV response"""
    if not data:
        return jsonify({'error': 'No data to export'}), 404
    
    # Create temporary CSV file
    csv_filename = f'/tmp/{filename}.csv'
    
    with open(csv_filename, 'w', newline='', encoding='utf-8') as csvfile:
        if data:
            fieldnames = data[0].keys()
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)
    
    return send_file(
        csv_filename,
        as_attachment=True,
        download_name=f'{filename}.csv',
        mimetype='text/csv'
    )

def generate_geojson_response(data: List[Dict], filename: str):
    """Generate GeoJSON response"""
    if not data:
        return jsonify({'error': 'No data to export'}), 404
    
    # Filter data with location information
    features = []
    for item in data:
        if 'latitude' in item and 'longitude' in item:
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [item['longitude'], item['latitude']]
                },
                'properties': {k: v for k, v in item.items() if k not in ['latitude', 'longitude']}
            }
            features.append(feature)
    
    geojson = {
        'type': 'FeatureCollection',
        'features': features
    }
    
    # Create temporary GeoJSON file
    geojson_filename = f'/tmp/{filename}.geojson'
    
    with open(geojson_filename, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, indent=2)
    
    return send_file(
        geojson_filename,
        as_attachment=True,
        download_name=f'{filename}.geojson',
        mimetype='application/geo+json'
    )

@app.route('/api/export/stats', methods=['GET'])
@auth.login_required
def export_stats():
    """Get export statistics"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get counts for each table
        cursor.execute('SELECT COUNT(*) as count FROM help_requests')
        help_requests_count = cursor.fetchone()['count']
        
        cursor.execute('SELECT COUNT(*) as count FROM resource_posts')
        resource_posts_count = cursor.fetchone()['count']
        
        cursor.execute('SELECT COUNT(*) as count FROM damage_reports')
        damage_reports_count = cursor.fetchone()['count']
        
        conn.close()
        
        return jsonify({
            'total_records': {
                'help_requests': help_requests_count,
                'resource_posts': resource_posts_count,
                'damage_reports': damage_reports_count,
            },
            'last_export': None,  # Would track this in production
            'export_formats': ['csv', 'geojson'],
            'privacy_features': [
                'location_jittering',
                'phone_masking',
                'note_filtering',
                'time_range_limiting'
            ]
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to get export stats: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5002)
