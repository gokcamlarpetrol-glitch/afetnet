#!/usr/bin/env python3
"""
Damage Report Backend Stub
Handles damage report ingestion and processing
"""

from flask import Flask, request, jsonify
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# In-memory storage for demo purposes
# In production, this would be a proper database
damage_reports_db: List[Dict[str, Any]] = []
processed_reports_db: List[Dict[str, Any]] = []

class DamageReportProcessor:
    """Processes and validates damage reports"""
    
    def __init__(self):
        self.severity_weights = {
            'minor': 1,
            'moderate': 2,
            'severe': 3,
            'critical': 4
        }
        
        self.type_priorities = {
            'building': 4,
            'bridge': 3,
            'utility': 2,
            'road': 1,
            'vehicle': 1,
            'other': 1
        }
    
    def validate_damage_report(self, report: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and score a damage report"""
        try:
            # Required fields validation
            required_fields = ['ts', 'lat', 'lon', 'type', 'severity', 'description']
            for field in required_fields:
                if field not in report:
                    return {
                        'valid': False,
                        'error': f'Missing required field: {field}'
                    }
            
            # Type validation
            if report['type'] not in self.type_priorities:
                return {
                    'valid': False,
                    'error': f'Invalid damage type: {report["type"]}'
                }
            
            # Severity validation
            if report['severity'] not in self.severity_weights:
                return {
                    'valid': False,
                    'error': f'Invalid severity level: {report["severity"]}'
                }
            
            # Location validation
            if not (-90 <= report['lat'] <= 90):
                return {
                    'valid': False,
                    'error': 'Invalid latitude'
                }
            
            if not (-180 <= report['lon'] <= 180):
                return {
                    'valid': False,
                    'error': 'Invalid longitude'
                }
            
            # Calculate priority score
            priority_score = self.calculate_priority_score(report)
            
            # Add validation metadata
            validated_report = {
                **report,
                'validated_at': int(time.time() * 1000),
                'priority_score': priority_score,
                'status': 'pending_review'
            }
            
            return {
                'valid': True,
                'report': validated_report
            }
            
        except Exception as e:
            logger.error(f"Error validating damage report: {e}")
            return {
                'valid': False,
                'error': f'Validation error: {str(e)}'
            }
    
    def calculate_priority_score(self, report: Dict[str, Any]) -> int:
        """Calculate priority score for damage report"""
        try:
            severity_weight = self.severity_weights.get(report['severity'], 1)
            type_priority = self.type_priorities.get(report['type'], 1)
            
            # Base score from severity and type
            base_score = severity_weight * type_priority
            
            # Bonus for recent reports (within last hour)
            report_age_hours = (time.time() * 1000 - report['ts']) / (1000 * 60 * 60)
            if report_age_hours < 1:
                base_score += 2
            
            # Bonus for reports with media
            if report.get('mediaUris') and len(report['mediaUris']) > 0:
                base_score += 1
            
            # Bonus for detailed descriptions
            if len(report.get('description', '')) > 100:
                base_score += 1
            
            return min(base_score, 10)  # Cap at 10
            
        except Exception as e:
            logger.error(f"Error calculating priority score: {e}")
            return 1
    
    def process_damage_report(self, report: Dict[str, Any]) -> Dict[str, Any]:
        """Process a validated damage report"""
        try:
            processed_report = {
                **report,
                'processed_at': int(time.time() * 1000),
                'status': 'processed',
                'assigned_to': self.assign_to_team(report),
                'estimated_response_time': self.estimate_response_time(report)
            }
            
            return processed_report
            
        except Exception as e:
            logger.error(f"Error processing damage report: {e}")
            return {
                **report,
                'processed_at': int(time.time() * 1000),
                'status': 'error',
                'error': str(e)
            }
    
    def assign_to_team(self, report: Dict[str, Any]) -> str:
        """Assign damage report to appropriate response team"""
        damage_type = report['type']
        severity = report['severity']
        
        if damage_type == 'building' and severity in ['severe', 'critical']:
            return 'search_rescue_team'
        elif damage_type == 'utility':
            return 'utility_repair_team'
        elif damage_type == 'bridge':
            return 'infrastructure_team'
        elif damage_type == 'road':
            return 'traffic_management_team'
        else:
            return 'general_response_team'
    
    def estimate_response_time(self, report: Dict[str, Any]) -> int:
        """Estimate response time in minutes"""
        severity = report['severity']
        damage_type = report['type']
        
        base_times = {
            'critical': 30,
            'severe': 60,
            'moderate': 120,
            'minor': 240
        }
        
        base_time = base_times.get(severity, 120)
        
        # Adjust based on type
        if damage_type == 'building' and severity in ['severe', 'critical']:
            base_time = min(base_time, 45)  # Faster for building damage
        elif damage_type == 'utility':
            base_time = max(base_time, 180)  # Slower for utility repairs
        
        return base_time

# Initialize processor
processor = DamageReportProcessor()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'damage-report-processor',
        'timestamp': int(time.time() * 1000)
    })

@app.route('/damage/ingest', methods=['POST'])
def ingest_damage_report():
    """Ingest a new damage report"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        logger.info(f"Received damage report: {data.get('type', 'unknown')} - {data.get('severity', 'unknown')}")
        
        # Validate the report
        validation_result = processor.validate_damage_report(data)
        
        if not validation_result['valid']:
            return jsonify({
                'success': False,
                'error': validation_result['error']
            }), 400
        
        validated_report = validation_result['report']
        
        # Process the report
        processed_report = processor.process_damage_report(validated_report)
        
        # Store in database
        damage_reports_db.append(processed_report)
        processed_reports_db.append(processed_report)
        
        logger.info(f"Processed damage report with priority score: {processed_report['priority_score']}")
        
        return jsonify({
            'success': True,
            'report_id': processed_report.get('id', 'unknown'),
            'priority_score': processed_report['priority_score'],
            'assigned_to': processed_report['assigned_to'],
            'estimated_response_time': processed_report['estimated_response_time'],
            'status': processed_report['status']
        })
        
    except Exception as e:
        logger.error(f"Error ingesting damage report: {e}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/damage/reports', methods=['GET'])
def get_damage_reports():
    """Get all damage reports with optional filtering"""
    try:
        # Query parameters
        severity = request.args.get('severity')
        damage_type = request.args.get('type')
        status = request.args.get('status')
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        # Filter reports
        filtered_reports = damage_reports_db.copy()
        
        if severity:
            filtered_reports = [r for r in filtered_reports if r['severity'] == severity]
        
        if damage_type:
            filtered_reports = [r for r in filtered_reports if r['type'] == damage_type]
        
        if status:
            filtered_reports = [r for r in filtered_reports if r['status'] == status]
        
        # Sort by priority score (descending) and timestamp (descending)
        filtered_reports.sort(key=lambda x: (-x['priority_score'], -x['ts']))
        
        # Apply pagination
        paginated_reports = filtered_reports[offset:offset + limit]
        
        return jsonify({
            'success': True,
            'reports': paginated_reports,
            'total': len(filtered_reports),
            'offset': offset,
            'limit': limit
        })
        
    except Exception as e:
        logger.error(f"Error getting damage reports: {e}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/damage/reports/<report_id>', methods=['GET'])
def get_damage_report(report_id: str):
    """Get a specific damage report by ID"""
    try:
        report = next((r for r in damage_reports_db if r.get('id') == report_id), None)
        
        if not report:
            return jsonify({
                'success': False,
                'error': 'Report not found'
            }), 404
        
        return jsonify({
            'success': True,
            'report': report
        })
        
    except Exception as e:
        logger.error(f"Error getting damage report {report_id}: {e}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/damage/stats', methods=['GET'])
def get_damage_stats():
    """Get damage report statistics"""
    try:
        total_reports = len(damage_reports_db)
        
        # Count by severity
        severity_counts = {}
        for report in damage_reports_db:
            severity = report['severity']
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        # Count by type
        type_counts = {}
        for report in damage_reports_db:
            damage_type = report['type']
            type_counts[damage_type] = type_counts.get(damage_type, 0) + 1
        
        # Count by status
        status_counts = {}
        for report in damage_reports_db:
            status = report['status']
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # Average response time
        processed_reports = [r for r in damage_reports_db if r['status'] == 'processed']
        avg_response_time = 0
        if processed_reports:
            total_time = sum(r['estimated_response_time'] for r in processed_reports)
            avg_response_time = total_time / len(processed_reports)
        
        return jsonify({
            'success': True,
            'stats': {
                'total_reports': total_reports,
                'severity_breakdown': severity_counts,
                'type_breakdown': type_counts,
                'status_breakdown': status_counts,
                'average_response_time_minutes': round(avg_response_time, 2)
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting damage stats: {e}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/damage/cleanup', methods=['POST'])
def cleanup_old_reports():
    """Clean up old damage reports (older than 30 days)"""
    try:
        cutoff_time = int(time.time() * 1000) - (30 * 24 * 60 * 60 * 1000)  # 30 days ago
        
        initial_count = len(damage_reports_db)
        
        # Remove old reports
        damage_reports_db[:] = [r for r in damage_reports_db if r['ts'] > cutoff_time]
        processed_reports_db[:] = [r for r in processed_reports_db if r['ts'] > cutoff_time]
        
        removed_count = initial_count - len(damage_reports_db)
        
        logger.info(f"Cleaned up {removed_count} old damage reports")
        
        return jsonify({
            'success': True,
            'removed_count': removed_count,
            'remaining_count': len(damage_reports_db)
        })
        
    except Exception as e:
        logger.error(f"Error cleaning up damage reports: {e}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

if __name__ == '__main__':
    print("Starting Damage Report Backend Stub...")
    print("Available endpoints:")
    print("  POST /damage/ingest - Ingest new damage report")
    print("  GET  /damage/reports - Get all damage reports")
    print("  GET  /damage/reports/<id> - Get specific damage report")
    print("  GET  /damage/stats - Get damage report statistics")
    print("  POST /damage/cleanup - Clean up old reports")
    print("  GET  /health - Health check")
    
    app.run(host='0.0.0.0', port=5003, debug=True)